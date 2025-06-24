import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1750778670547 implements MigrationInterface {
  name = "InitSchema1750778670547"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("CREATE TABLE \"nav_method_value\" (\"id\" SERIAL NOT NULL, \"fundAddress\" character varying NOT NULL, \"fundChainId\" character varying NOT NULL, \"navUpdateId\" integer NOT NULL, \"navUpdateIndex\" integer NOT NULL, \"navMethodId\" integer NOT NULL, \"totalNavSnapshotId\" integer, \"detailsHash\" character varying(66), \"simulatedNav\" character varying NOT NULL, \"simulatedNavFormatted\" character varying NOT NULL, \"calculatedAt\" TIMESTAMP, \"createdAt\" TIMESTAMP NOT NULL DEFAULT now(), \"updatedAt\" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT \"PK_5fde8074ddcc679e8e9c6f6af5e\" PRIMARY KEY (\"id\"))");
    await queryRunner.query("CREATE INDEX \"IDX_da9260b8d000e1431a028029b4\" ON \"nav_method_value\" (\"fundAddress\") ");
    await queryRunner.query("CREATE INDEX \"IDX_858e4833b62ba73be2c81b9915\" ON \"nav_method_value\" (\"fundChainId\") ");
    await queryRunner.query("CREATE INDEX \"IDX_4fc1468e43f780bfd2da063d38\" ON \"nav_method_value\" (\"navUpdateId\") ");
    await queryRunner.query("CREATE INDEX \"IDX_ac3b4f3249f5512655da94236b\" ON \"nav_method_value\" (\"navUpdateIndex\") ");
    await queryRunner.query("CREATE INDEX \"IDX_72f63185d92638b403081b497a\" ON \"nav_method_value\" (\"navMethodId\") ");
    await queryRunner.query("CREATE INDEX \"IDX_822cba7cd9a32fb77b741140dc\" ON \"nav_method_value\" (\"totalNavSnapshotId\") ");
    await queryRunner.query("CREATE INDEX \"IDX_a8f812cffb9fd238982bc1a859\" ON \"nav_method_value\" (\"detailsHash\") ");
    await queryRunner.query("CREATE INDEX \"IDX_e667f5ec8a16e01e2709d8a8bd\" ON \"nav_method_value\" (\"calculatedAt\") ");
    await queryRunner.query("CREATE INDEX \"IDX_8fa0750a9fae3c2310d23ca9ed\" ON \"nav_method_value\" (\"createdAt\") ");
    await queryRunner.query("CREATE TABLE \"nav_method\" (\"id\" SERIAL NOT NULL, \"fundAddress\" character varying NOT NULL, \"fundChainId\" character varying NOT NULL, \"navUpdateIndex\" integer NOT NULL, \"navUpdateId\" integer NOT NULL, \"methodDetails\" text, \"detailsHash\" character varying(66), \"createdAt\" TIMESTAMP NOT NULL DEFAULT now(), \"updatedAt\" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT \"PK_6307a86b0f276cae626cd89920b\" PRIMARY KEY (\"id\"))");
    await queryRunner.query("CREATE INDEX \"IDX_254e659ea5f3327343c5ad02e5\" ON \"nav_method\" (\"fundAddress\") ");
    await queryRunner.query("CREATE INDEX \"IDX_f8269f004b791379ef5f1aa0b4\" ON \"nav_method\" (\"fundChainId\") ");
    await queryRunner.query("CREATE INDEX \"IDX_2dc836059629ae7b4bdf9f79c4\" ON \"nav_method\" (\"navUpdateIndex\") ");
    await queryRunner.query("CREATE INDEX \"IDX_7e808d8c21b79b8c29a1f35317\" ON \"nav_method\" (\"navUpdateId\") ");
    await queryRunner.query("CREATE INDEX \"IDX_36513b4f1116648e1e397a7ae7\" ON \"nav_method\" (\"detailsHash\") ");
    await queryRunner.query("CREATE INDEX \"IDX_3e2b68c28d6a9bab825657f58c\" ON \"nav_method\" (\"createdAt\") ");
    await queryRunner.query("CREATE TABLE \"nav_update\" (\"id\" SERIAL NOT NULL, \"fundAddress\" character varying NOT NULL, \"fundChainId\" character varying NOT NULL, \"navUpdateIndex\" integer NOT NULL, \"safeAddress\" character varying(78) NOT NULL, \"baseDecimals\" integer NOT NULL, \"baseSymbol\" character varying NOT NULL, \"createdAt\" TIMESTAMP NOT NULL DEFAULT now(), \"updatedAt\" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT \"PK_1a32f78c24ab8232c3f1ad28b61\" PRIMARY KEY (\"id\"))");
    await queryRunner.query("CREATE INDEX \"IDX_414c8b178799a27d25bd7b22ba\" ON \"nav_update\" (\"fundAddress\") ");
    await queryRunner.query("CREATE INDEX \"IDX_4bf6f99b67202577e1c3a43ac0\" ON \"nav_update\" (\"fundChainId\") ");
    await queryRunner.query("CREATE INDEX \"IDX_a25dd32c2df95c761362580171\" ON \"nav_update\" (\"navUpdateIndex\") ");
    await queryRunner.query("CREATE INDEX \"IDX_cc8546b7a3e0c0a852e64ebb44\" ON \"nav_update\" (\"createdAt\") ");
    await queryRunner.query("CREATE TABLE \"total_nav_snapshot\" (\"id\" SERIAL NOT NULL, \"fundAddress\" character varying NOT NULL, \"fundChainId\" character varying NOT NULL, \"navUpdateId\" integer NOT NULL, \"navUpdateIndex\" integer NOT NULL, \"totalSimulatedNav\" character varying NOT NULL, \"totalSimulatedNavFormatted\" character varying NOT NULL, \"calculatedAt\" TIMESTAMP NOT NULL, \"createdAt\" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT \"PK_ad8c93ce18fe369f4f9cd3b3c55\" PRIMARY KEY (\"id\"))");
    await queryRunner.query("CREATE INDEX \"IDX_4e313c45f87511815ad348a4d1\" ON \"total_nav_snapshot\" (\"fundAddress\") ");
    await queryRunner.query("CREATE INDEX \"IDX_4089006e0fc5fb8a860d5e6529\" ON \"total_nav_snapshot\" (\"fundChainId\") ");
    await queryRunner.query("CREATE INDEX \"IDX_e3e2bce2653a8bf2c141cf5b0e\" ON \"total_nav_snapshot\" (\"navUpdateId\") ");
    await queryRunner.query("CREATE INDEX \"IDX_bdf35f9c277a327741c229786d\" ON \"total_nav_snapshot\" (\"navUpdateIndex\") ");
    await queryRunner.query("CREATE INDEX \"IDX_19ee523b980308c32390cb3104\" ON \"total_nav_snapshot\" (\"calculatedAt\") ");
    await queryRunner.query("CREATE INDEX \"IDX_37a64a857e3ca7d76e3e4e7549\" ON \"total_nav_snapshot\" (\"createdAt\") ");
    await queryRunner.query("ALTER TABLE \"nav_method_value\" ADD CONSTRAINT \"FK_4fc1468e43f780bfd2da063d388\" FOREIGN KEY (\"navUpdateId\") REFERENCES \"nav_update\"(\"id\") ON DELETE NO ACTION ON UPDATE NO ACTION");
    await queryRunner.query("ALTER TABLE \"nav_method_value\" ADD CONSTRAINT \"FK_72f63185d92638b403081b497ab\" FOREIGN KEY (\"navMethodId\") REFERENCES \"nav_method\"(\"id\") ON DELETE NO ACTION ON UPDATE NO ACTION");
    await queryRunner.query("ALTER TABLE \"nav_method_value\" ADD CONSTRAINT \"FK_822cba7cd9a32fb77b741140dcc\" FOREIGN KEY (\"totalNavSnapshotId\") REFERENCES \"total_nav_snapshot\"(\"id\") ON DELETE NO ACTION ON UPDATE NO ACTION");
    await queryRunner.query("ALTER TABLE \"nav_method\" ADD CONSTRAINT \"FK_7e808d8c21b79b8c29a1f353177\" FOREIGN KEY (\"navUpdateId\") REFERENCES \"nav_update\"(\"id\") ON DELETE NO ACTION ON UPDATE NO ACTION");
    await queryRunner.query("ALTER TABLE \"total_nav_snapshot\" ADD CONSTRAINT \"FK_e3e2bce2653a8bf2c141cf5b0e0\" FOREIGN KEY (\"navUpdateId\") REFERENCES \"nav_update\"(\"id\") ON DELETE NO ACTION ON UPDATE NO ACTION");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE \"total_nav_snapshot\" DROP CONSTRAINT \"FK_e3e2bce2653a8bf2c141cf5b0e0\"");
    await queryRunner.query("ALTER TABLE \"nav_method\" DROP CONSTRAINT \"FK_7e808d8c21b79b8c29a1f353177\"");
    await queryRunner.query("ALTER TABLE \"nav_method_value\" DROP CONSTRAINT \"FK_822cba7cd9a32fb77b741140dcc\"");
    await queryRunner.query("ALTER TABLE \"nav_method_value\" DROP CONSTRAINT \"FK_72f63185d92638b403081b497ab\"");
    await queryRunner.query("ALTER TABLE \"nav_method_value\" DROP CONSTRAINT \"FK_4fc1468e43f780bfd2da063d388\"");
    await queryRunner.query("DROP INDEX \"public\".\"IDX_37a64a857e3ca7d76e3e4e7549\"");
    await queryRunner.query("DROP INDEX \"public\".\"IDX_19ee523b980308c32390cb3104\"");
    await queryRunner.query("DROP INDEX \"public\".\"IDX_bdf35f9c277a327741c229786d\"");
    await queryRunner.query("DROP INDEX \"public\".\"IDX_e3e2bce2653a8bf2c141cf5b0e\"");
    await queryRunner.query("DROP INDEX \"public\".\"IDX_4089006e0fc5fb8a860d5e6529\"");
    await queryRunner.query("DROP INDEX \"public\".\"IDX_4e313c45f87511815ad348a4d1\"");
    await queryRunner.query("DROP TABLE \"total_nav_snapshot\"");
    await queryRunner.query("DROP INDEX \"public\".\"IDX_cc8546b7a3e0c0a852e64ebb44\"");
    await queryRunner.query("DROP INDEX \"public\".\"IDX_a25dd32c2df95c761362580171\"");
    await queryRunner.query("DROP INDEX \"public\".\"IDX_4bf6f99b67202577e1c3a43ac0\"");
    await queryRunner.query("DROP INDEX \"public\".\"IDX_414c8b178799a27d25bd7b22ba\"");
    await queryRunner.query("DROP TABLE \"nav_update\"");
    await queryRunner.query("DROP INDEX \"public\".\"IDX_3e2b68c28d6a9bab825657f58c\"");
    await queryRunner.query("DROP INDEX \"public\".\"IDX_36513b4f1116648e1e397a7ae7\"");
    await queryRunner.query("DROP INDEX \"public\".\"IDX_7e808d8c21b79b8c29a1f35317\"");
    await queryRunner.query("DROP INDEX \"public\".\"IDX_2dc836059629ae7b4bdf9f79c4\"");
    await queryRunner.query("DROP INDEX \"public\".\"IDX_f8269f004b791379ef5f1aa0b4\"");
    await queryRunner.query("DROP INDEX \"public\".\"IDX_254e659ea5f3327343c5ad02e5\"");
    await queryRunner.query("DROP TABLE \"nav_method\"");
    await queryRunner.query("DROP INDEX \"public\".\"IDX_8fa0750a9fae3c2310d23ca9ed\"");
    await queryRunner.query("DROP INDEX \"public\".\"IDX_e667f5ec8a16e01e2709d8a8bd\"");
    await queryRunner.query("DROP INDEX \"public\".\"IDX_a8f812cffb9fd238982bc1a859\"");
    await queryRunner.query("DROP INDEX \"public\".\"IDX_822cba7cd9a32fb77b741140dc\"");
    await queryRunner.query("DROP INDEX \"public\".\"IDX_72f63185d92638b403081b497a\"");
    await queryRunner.query("DROP INDEX \"public\".\"IDX_ac3b4f3249f5512655da94236b\"");
    await queryRunner.query("DROP INDEX \"public\".\"IDX_4fc1468e43f780bfd2da063d38\"");
    await queryRunner.query("DROP INDEX \"public\".\"IDX_858e4833b62ba73be2c81b9915\"");
    await queryRunner.query("DROP INDEX \"public\".\"IDX_da9260b8d000e1431a028029b4\"");
    await queryRunner.query("DROP TABLE \"nav_method_value\"");
  }

}
