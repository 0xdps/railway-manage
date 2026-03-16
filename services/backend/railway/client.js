import config from '../core/config.js';
import logger from '../core/logger.js';

/**
 * Railway GraphQL API client.
 * Endpoint: https://backboard.railway.app/graphql/v2
 */
class RailwayClient {
  constructor() {
    this.endpoint = 'https://backboard.railway.app/graphql/v2';
    this.token = config.railwayToken;
  }

  /**
   * Make a GraphQL request to Railway API.
   */
  async request(query, variables = {}) {
    const headers = {
      'Content-Type': 'application/json',
    };

    // Support both Bearer tokens (pk_...) and project tokens (pt_...)
    if (this.token.startsWith('pt_')) {
      headers['Project-Access-Token'] = this.token;
    } else {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
      });

      const data = await response.json();

      if (data.errors) {
        const errorMsg = data.errors[0]?.message || 'Unknown API error';
        logger.error({ errors: data.errors }, 'Railway API error');
        throw new Error(`Railway API Error: ${errorMsg}`);
      }

      return data.data || {};
    } catch (error) {
      logger.error(error, 'Railway API request failed');
      throw error;
    }
  }

  /**
   * Get services deployed in the environment — enriched with source, deployment
   * status, domains, volumes, and replica count.
   */
  async getServices(projectId, environmentId) {
    const query = `
      query GetServicesEnriched($projectId: String!) {
        project(id: $projectId) {
          services {
            edges {
              node {
                id
                name
                serviceInstances {
                  edges {
                    node {
                      environmentId
                      id
                      source {
                        image
                        repo
                      }
                      latestDeployment {
                        id
                        status
                        createdAt
                        updatedAt
                      }
                      domains {
                        serviceDomains {
                          domain
                        }
                        customDomains {
                          domain
                        }
                      }
                      numReplicas
                      upstreamUrl
                    }
                  }
                }
              }
            }
          }
          volumes {
            edges {
              node {
                id
                name
                volumeInstances {
                  edges {
                    node {
                      environmentId
                      serviceId
                      mountPath
                      sizeMB
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const data = await this.request(query, { projectId });
    const services = [];

    // Build volume map: serviceId → [{id, name, mountPath, sizeMB}]
    const volumeMap = {};
    for (const volEdge of data.project?.volumes?.edges || []) {
      const vol = volEdge.node;
      for (const instEdge of vol.volumeInstances?.edges || []) {
        const inst = instEdge.node;
        if (inst.environmentId === environmentId) {
          if (!volumeMap[inst.serviceId]) volumeMap[inst.serviceId] = [];
          volumeMap[inst.serviceId].push({
            id: vol.id,
            name: vol.name,
            mountPath: inst.mountPath,
            sizeMB: inst.sizeMB,
          });
        }
      }
    }

    for (const edge of data.project?.services?.edges || []) {
      const node = edge.node;
      const instance = node.serviceInstances?.edges?.find(
        (e) => e.node?.environmentId === environmentId
      )?.node;

      if (!instance) continue;

      const src = instance.source || node.source || {};
      const domains = [
        ...(instance.domains?.serviceDomains || []).map((d) => d.domain),
        ...(instance.domains?.customDomains  || []).map((d) => d.domain),
      ].filter(Boolean);

      services.push({
        id: node.id,
        name: node.name,
        source: {
          image: src.image || null,
          repo:  src.repo  || null,
        },
        status:     instance.latestDeployment?.status    || null,
        deployedAt: instance.latestDeployment?.createdAt || null,
        domains,
        volumes:     volumeMap[node.id] || [],
        numReplicas: instance.numReplicas  || 1,
        upstreamUrl: instance.upstreamUrl  || null,
      });
    }

    return services;
  }

  /**
   * Get the latest CPU and memory snapshot for a service by querying the
   * Railway metrics time-series API (last 10 minutes, 60-second resolution).
   * Returns { cpu: number|null, memoryGB: number|null }.
   */
  async getServiceMetrics(serviceId) {
    const start = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min ago

    // Railway's metrics API expects measurements as [MetricMeasurement!]!
    const cpuQuery = `
      query GetCpuMetrics(
        $projectId: String!, $serviceId: String!, $startDate: DateTime!, $measurements: [MetricMeasurement!]!
      ) {
        metrics(
          projectId: $projectId
          serviceId: $serviceId
          startDate: $startDate
          measurements: $measurements
        ) {
          values { ts value }
        }
      }
    `;

    const commonVars = {
      projectId:  config.railwayProjectId,
      serviceId,
      startDate:  start,
    };

    const [cpuData, memData] = await Promise.all([
      this.request(cpuQuery, { ...commonVars, measurements: ['CPU_USAGE'] }),
      this.request(cpuQuery, { ...commonVars, measurements: ['MEMORY_USAGE_GB'] }),
    ]);

    const latestValue = (series) => {
      const values = series?.metrics?.[0]?.values ?? [];
      const nonNull = values.filter((v) => v.value != null);
      if (!nonNull.length) return null;
      // ts is a unix timestamp (seconds) — pick the largest
      return nonNull.reduce((a, b) => (b.ts > a.ts ? b : a)).value;
    };

    return {
      cpu:      latestValue(cpuData),
      memoryGB: latestValue(memData),
    };
  }

  /**
   * Get latest deployments for a service.
   */
  async getDeployments(serviceId, limit = 10) {
    const query = `
      query GetDeployments($serviceId: String!, $limit: Int!) {
        deployments(
          input: { serviceId: $serviceId }
          last: $limit
        ) {
          edges {
            node {
              id
              status
              createdAt
              updatedAt
              statusUpdatedAt
              url
              meta
            }
          }
        }
      }
    `;

    const data = await this.request(query, { serviceId, limit });
    return (data.deployments?.edges || []).map((e) => e.node);
  }

  /**
   * Redeploy (restart) a service - triggers a new deployment.
   */
  async redeployService(serviceId, environmentId) {    const query = `
      mutation Redeploy($serviceId: String!, $environmentId: String!) {
        serviceInstanceRedeploy(
          serviceId: $serviceId
          environmentId: $environmentId
        ) {
          id
          status
        }
      }
    `;

    const data = await this.request(query, {
      serviceId,
      environmentId,
    });

    return data.serviceInstanceRedeploy || {};
  }

  /**
   * Get all variable key names for a service in an environment.
   * Returns only the keys (names) — values are never sent to the client.
   */
  async getServiceVariableKeys(serviceId, environmentId, projectId) {
    const query = `
      query GetServiceVariables($serviceId: String!, $environmentId: String!, $projectId: String!) {
        variables(serviceId: $serviceId, environmentId: $environmentId, projectId: $projectId)
      }
    `;
    const data = await this.request(query, { serviceId, environmentId, projectId });
    return Object.keys(data.variables || {});
  }

  /**
   * Fetch the value of a single variable at backup time.
   * Called server-side only — value is never exposed to the frontend.
   */
  async getServiceVariable(serviceId, envVarKey, environmentId, projectId) {
    const query = `
      query GetServiceVariables($serviceId: String!, $environmentId: String!, $projectId: String!) {
        variables(serviceId: $serviceId, environmentId: $environmentId, projectId: $projectId)
      }
    `;
    const data = await this.request(query, { serviceId, environmentId, projectId });
    const value = (data.variables || {})[envVarKey];
    if (!value) {
      throw new Error(
        `Variable "${envVarKey}" not found for service ${serviceId} in environment ${environmentId}`
      );
    }
    return value;
  }
}

export default new RailwayClient();
