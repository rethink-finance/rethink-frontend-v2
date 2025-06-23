import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, OneToMany } from "typeorm";
import { NavMethod } from "./nav-method.entity";

@Entity()
export class NavUpdate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
    fundAddress: string;

  @Column()
  @Index()
    fundChainId: string;

  @Column()
  @Index()
    navUpdateIndex: number;

  @Column({ type: "varchar", length: 78 })
    safeAddress: string;

  @Column()
    baseDecimals: number;

  @Column()
    baseSymbol: string;

  @OneToMany(() => NavMethod, navMethod => navMethod.navUpdate)
    navMethods: NavMethod[];

  @CreateDateColumn()
  @Index()
    createdAt: Date;

  @UpdateDateColumn()
    updatedAt: Date;
}
