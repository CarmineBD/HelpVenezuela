export const env = {
  port: Number(process.env.API_PORT ?? 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5174",
};
