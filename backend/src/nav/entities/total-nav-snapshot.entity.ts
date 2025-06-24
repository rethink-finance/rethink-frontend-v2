import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { NavUpdate } from "./nav-update.entity";
import { NavMethodValue } from "./nav-method-value.entity";

@Entity()
export class TotalNavSnapshot {
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
    navUpdateId: number;

  @ManyToOne(() => NavUpdate)
  @JoinColumn({ name: "navUpdateId" })
    navUpdate: NavUpdate;

  @Column()
  @Index()
    navUpdateIndex: number;

  @Column()
    totalSimulatedNav: string;

  @Column()
    totalSimulatedNavFormatted: string;

  @OneToMany(() => NavMethodValue, value => value.totalNavSnapshot)
    navMethodValues: NavMethodValue[];

  @Column()
  @Index()
    calculatedAt: Date;

  @CreateDateColumn()
  @Index()
    createdAt: Date;
}
