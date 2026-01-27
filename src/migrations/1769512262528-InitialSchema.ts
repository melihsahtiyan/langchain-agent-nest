import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1769512262528 implements MigrationInterface {
    name = 'InitialSchema1769512262528'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "application_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "level" character varying(20) NOT NULL, "message" text NOT NULL, "context" character varying(100), "metadata" jsonb NOT NULL DEFAULT '{}', "error" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ffc2b5aecb856403c56de243529" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0724214727c044da78ded05f6e" ON "application_logs" ("level") `);
        await queryRunner.query(`CREATE INDEX "IDX_8e6a44ae512436294e6130026c" ON "application_logs" ("context") `);
        await queryRunner.query(`CREATE INDEX "IDX_ce1b582d753b22719e2ed21b26" ON "application_logs" ("created_at") `);
        await queryRunner.query(`CREATE TABLE "chat_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "session_id" character varying(255) NOT NULL, "role" character varying(50) NOT NULL, "content" text NOT NULL, "metadata" jsonb NOT NULL DEFAULT '{}', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_cf76a7693b0b075dd86ea05f21d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_52b77cc1e265277ab18494be42" ON "chat_history" ("session_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_b8a3c2611b22bb205c1793c76b" ON "chat_history" ("created_at") `);
        // Note: Using vector(384) for Xenova/all-MiniLM-L6-v2 embedding model
        await queryRunner.query(`CREATE TABLE "documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "content" text NOT NULL, "embedding" vector(384), "metadata" jsonb NOT NULL DEFAULT '{}', "is_temporary" boolean NOT NULL DEFAULT true, "expires_at" TIMESTAMP WITH TIME ZONE, "promoted_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ac51aa5181ee2036f5ca482857c" PRIMARY KEY ("id"))`);
        // Use HNSW index for fast approximate nearest neighbor search
        await queryRunner.query(`CREATE INDEX "IDX_documents_embedding_hnsw" ON "documents" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64)`);
        await queryRunner.query(`CREATE INDEX "IDX_3375b197c09c39d9ff50c66d29" ON "documents" ("expires_at") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_3375b197c09c39d9ff50c66d29"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_documents_embedding_hnsw"`);
        await queryRunner.query(`DROP TABLE "documents"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b8a3c2611b22bb205c1793c76b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_52b77cc1e265277ab18494be42"`);
        await queryRunner.query(`DROP TABLE "chat_history"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ce1b582d753b22719e2ed21b26"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8e6a44ae512436294e6130026c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0724214727c044da78ded05f6e"`);
        await queryRunner.query(`DROP TABLE "application_logs"`);
    }

}
