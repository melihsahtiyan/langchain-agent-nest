import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    host: process.env.DATABASE_URL
      ? undefined
      : process.env.DB_HOST || 'localhost',
    port: process.env.DATABASE_URL
      ? undefined
      : parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DATABASE_URL ? undefined : process.env.DB_USERNAME,
    password: process.env.DATABASE_URL ? undefined : process.env.DB_PASSWORD,
    database: process.env.DATABASE_URL ? undefined : process.env.DB_NAME,
    autoLoadEntities: true,
    // Always use migrations, never synchronize
    synchronize: false,
    // Run migrations automatically on app start
    migrationsRun: true,
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    logging: process.env.NODE_ENV !== 'production',
  }),
);
