import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from "typeorm";

@Entity()
export class NavValue {
  @PrimaryGeneratedColumn("uuid")
    id: string;

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

  @Column({ type: "numeric", precision: 78, scale: 0, transformer: {
    to: (value: bigint) => value.toString(),
    from: (value: string) => BigInt(value),
  } })
    simulatedNav: string; // Stored as string to handle BigInt

  @Column()
    simulatedNavFormatted: string;

  @Column()
    baseDecimals: number;

  @Column()
    baseSymbol: string;

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
    navMethodDetails: Record<string, any>;

  @Column({ type: "varchar", length: 66, nullable: true })
    detailsHash: string;

  @CreateDateColumn()
  @Index()
    createdAt: Date;

  @UpdateDateColumn()
    updatedAt: Date;

  @Column({ type: "datetime", nullable: true })
  @Index()
    calculatedAt: Date;
}
