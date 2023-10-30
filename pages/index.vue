<template>
  <!-- <v-toolbar-title color="primary">Rethink Fund DAOs</v-toolbar-title> -->
  <Table :data="data" :columns="columns" />
</template>

<script setup>
import { ref } from "vue";

const columns = ref([
  {
    accessorKey: "fund-name",
    header: "Fund Name",
    cell: (info) => info.getValue(),
  },
  {
    accessorKey: "aum",
    header: "AUM",
    cell: (info) => info.getValue(),
  },
  {
    accessorKey: "inception",
    header: "Inception",
    cell: (info) => info.getValue(),
  },
  {
    accessorKey: "comulative",
    header: "Comulative",
    cell: (info) => info.getValue(),
  },
  {
    accessorKey: "monthly",
    header: "Monthly",
    cell: (info) => info.getValue(),
  },
  {
    accessorKey: "sharp-ratio",
    header: "Sharp Ratio",
    cell: (info) => info.getValue(),
  },
  {
    accessorKey: "position-types",
    header: "Position Types",
    cell: (info) => info.getValue(),
  },
]);

const data = ref([
  {
    id: 1,
    "fund-name": "SOON",
    aum: "$222,222,222",
    inception: "9:00am PDT",
    comulative: "39.44%",
    monthly: "88.09%",
    "sharp-ratio": "88.09%",
    "position-types": "liquid",
  },
  {
    id: 2,
    "fund-name": "THL",
    aum: "$222,222,222",
    inception: "YYYY Nov DD",
    comulative: "39.44%",
    monthly: "-8.09%",
    "sharp-ratio": "88.09%",
    "position-types": "Defi",
  },
  {
    id: 3,
    "fund-name": "1FUND",
    aum: "$222,222,222",
    inception: "YYYY Nov DD",
    comulative: "39.44%",
    monthly: "88.09%",
    "sharp-ratio": "88.09%",
    "position-types": "Nft",
  },
  {
    id: 4,
    "fund-name": "AF",
    aum: "$222,222,222",
    inception: "YYYY Nov DD",
    comulative: "-39.44%",
    monthly: "-8.09%",
    "sharp-ratio": "88.09%",
    "position-types": "Nft",
  },
]);
</script>
