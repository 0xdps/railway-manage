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
   * Get services deployed in the environment.
   */
  async getServices(projectId, environmentId) {
    const query = `
      query GetServices($projectId: String!) {
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

    for (const edge of data.project?.services?.edges || []) {
      const node = edge.node;
      const inEnv = node.serviceInstances?.edges?.some(
        (instEdge) => instEdge.node?.environmentId === environmentId
      );

      if (inEnv) {
        services.push({ id: node.id, name: node.name });
      }
    }

    return services;
  }

  /**
   * Get service metrics (CPU, memory) for an environment.
   */
  async getServiceMetrics(serviceId, environmentId) {
    const query = `
      query GetServiceMetrics($serviceId: String!, $environmentId: String!) {
        serviceInstance(serviceId: $serviceId, environmentId: $environmentId) {
          id
          status
          currentStatus {
            cpu
            memory
          }
        }
      }
    `;

    const data = await this.request(query, { 
      serviceId, 
      environmentId 
    });

    return data.serviceInstance || {};
  }

  /**
   * Get latest deployments for a service.
   */
  async getDeployments(serviceId, environmentId, limit = 10) {
    const query = `
      query GetDeployments($serviceId: String!, $environmentId: String!, $limit: Int!) {
        deployments(
          serviceId: $serviceId
          environmentId: $environmentId
          first: $limit
        ) {
          edges {
            node {
              id
              status
              createdAt
              updatedAt
            }
          }
        }
      }
    `;

    const data = await this.request(query, {
      serviceId,
      environmentId,
      limit,
    });

    return (data.deployments?.edges || []).map((edge) => edge.node);
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
  async getServiceVariableKeys(serviceId, environmentId) {
    const query = `
      query GetServiceVariables($serviceId: String!, $environmentId: String!) {
        variables(serviceId: $serviceId, environmentId: $environmentId)
      }
    `;
    const data = await this.request(query, { serviceId, environmentId });
    return Object.keys(data.variables || {});
  }

  /**
   * Fetch the value of a single variable at backup time.
   * Called server-side only — value is never exposed to the frontend.
   */
  async getServiceVariable(serviceId, envVarKey, environmentId) {
    const query = `
      query GetServiceVariables($serviceId: String!, $environmentId: String!) {
        variables(serviceId: $serviceId, environmentId: $environmentId)
      }
    `;
    const data = await this.request(query, { serviceId, environmentId });
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
