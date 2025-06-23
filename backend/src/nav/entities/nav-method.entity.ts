import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, OneToMany, JoinColumn } from "typeorm";
import { NavUpdate } from "./nav-update.entity";
import { NavMethodValue } from "./nav-method-value.entity";

@Entity()
export class NavMethod {
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

  @Column()
  @Index()
    navUpdateId: number;

  @ManyToOne(() => NavUpdate, navUpdate => navUpdate.navMethods)
  @JoinColumn({ name: "navUpdateId" })
    navUpdate: NavUpdate;

  @Column({
    type: "simple-json",
    nullable: true,
    transformer: {
      // Convert bigint to string when serializing
      to: (value: Record<string, any>) => {
        return value
          ? JSON.parse(JSON.stringify(value, (_, v) => typeof v === "bigint" ? v.toString() : v))
          : null;
      },
      from: (value: any) => value, // Keep as-is when reading
    },
  })
    methodDetails: Record<string, any>;

  @Column({ type: "varchar", length: 66, nullable: true })
  @Index()
    detailsHash: string;

  @OneToMany(() => NavMethodValue, navMethodValue => navMethodValue.navMethod)
    navMethodValues: NavMethodValue[];

  @CreateDateColumn()
  @Index()
    createdAt: Date;

  @UpdateDateColumn()
    updatedAt: Date;
}
