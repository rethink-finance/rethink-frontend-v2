import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from "typeorm";
import { NavUpdate } from "./nav-update.entity";
import { NavMethod } from "./nav-method.entity";

@Entity()
export class NavMethodValue {
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
  @Index()
    navMethodId: number;

  @ManyToOne(() => NavMethod, navMethod => navMethod.navMethodValues)
  @JoinColumn({ name: "navMethodId" })
    navMethod: NavMethod;

  @Column({ type: "varchar", length: 66, nullable: true })
  @Index()
    detailsHash: string;

  @Column({ type: "numeric", precision: 78, scale: 0, transformer: {
    to: (value: bigint) => value.toString(),
    from: (value: string) => BigInt(value),
  } })
    simulatedNav: string; // Stored as string to handle BigInt

  @Column()
    simulatedNavFormatted: string;

  @Column({ type: "timestamp", nullable: true })
  @Index()
    calculatedAt: Date;

  @CreateDateColumn()
  @Index()
    createdAt: Date;

  @UpdateDateColumn()
    updatedAt: Date;
}
