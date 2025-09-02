import { fastify } from '../services/fastify';

describe('Fastify server', () => {
  it('should validate allowed origin if CORS_ALLOWED_ORIGINS is defined', async () => {
    process.env.CORS_ALLOWED_ORIGINS = 'https://test.domain.net, http://test.domain.net';
    const response = await fastify.inject({
      method: 'OPTIONS',
      url: '/',
      headers: {
        'origin': 'https://test.domain.net'
      }
    });
    if (response.headers) {
      expect(response.headers['access-control-allow-origin']).toEqual('https://test.domain.net');
    }
    process.env.CORS_ALLOWED_ORIGINS = '';
  });  
});
  
