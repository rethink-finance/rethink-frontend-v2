<template>
  <div class="d-flex" style="width: 100%; flex-direction: column">
    <v-toolbar
      flat
      color="transparent"
      style="width: 100%; padding-inline: 200px"
      class="mt-10 mb-4"
    >
      <h3 style="color: #205fff">Rethink Fund DAOs</h3>
    </v-toolbar>
    <Table :data="data" :columns="columns" :showControls="false" />
  </div>
</template>

<script setup lang="jsx">
import { ref, h } from "vue";
import FundNameCell from "../components/table/components/FundNameCell";

const columns = ref([
  {
    accessorKey: "fund-name",
    header: "Fund Name",
    cell: (info) => {
      const data = info.getValue();
      return h(<FundNameCell />, {
        image: info.getValue().avatar,
        title: info.getValue().title,
        subtitle: info.getValue().subtitle,
      });
    },
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
    "fund-name": {
      title: "SOON",
      subtitle: "Soonami Treasury",
      avatar: "https://api.lorem.space/image/finance?w=60&h=60",
    },
    aum: "$222,222,222",
    inception: "9:00am PDT",
    comulative: "39.44%",
    monthly: "88.09%",
    "sharp-ratio": "88.09%",
    "position-types": "liquid",
  },
  {
    id: 2,
    "fund-name": {
      title: "THL",
      subtitle: "Tetronode Treasury",
      avatar: "https://api.lorem.space/image/ai?w=60&h=60",
    },
    aum: "$222,222,222",
    inception: "YYYY Nov DD",
    comulative: "39.44%",
    monthly: "-8.09%",
    "sharp-ratio": "88.09%",
    "position-types": "Defi",
  },
  {
    id: 3,
    "fund-name": {
      title: "1FUND",
      subtitle: "1FUND DAO",
      avatar: "https://api.lorem.space/image/game?w=60&h=60",
    },
    aum: "$222,222,222",
    inception: "YYYY Nov DD",
    comulative: "39.44%",
    monthly: "88.09%",
    "sharp-ratio": "88.09%",
    "position-types": "Nft",
  },
  {
    id: 4,
    "fund-name": {
      title: "AF",
      subtitle: "Awesome Fund",
      avatar: "https://api.lorem.space/image/dashboard?w=60&h=60",
    },
    aum: "$222,222,222",
    inception: "YYYY Nov DD",
    comulative: "-39.44%",
    monthly: "-8.09%",
    "sharp-ratio": "88.09%",
    "position-types": "Nft",
  },
]);
</script>
