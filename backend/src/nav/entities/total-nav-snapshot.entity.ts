import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from "typeorm";
import { NavUpdate } from "./nav-update.entity";

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

  @Column({ type: "timestamp", nullable: true })
  @Index()
    calculatedAt: Date;

  @CreateDateColumn()
  @Index()
    createdAt: Date;
}
