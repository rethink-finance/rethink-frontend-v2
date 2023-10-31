<template>
  <v-toolbar-title color="primary">Rethink Fund DAOs</v-toolbar-title>
  <Table :data="data" :columns="columns" caption />
</template>

<script setup lang="jsx">
import { ref, h } from "vue";

const columns = ref([
  {
    accessorKey: "fund-name",
    header: "Fund Name",
    cell: (info) => info.getValue().title,
    // cell: (info) => {
    //   const data = info.getValue();
    //   return h(<FundNameCell />, {
    //     image: info.getValue().avatar,
    //     title: info.getValue().title,
    //     subtitle: info.getValue().subtitle,
    //   });
    // },
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
      avatar: "https://api.lorem.space/image/finance?w=60&h=60",
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
      avatar: "https://api.lorem.space/image/finance?w=60&h=60",
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
      avatar: "https://api.lorem.space/image/finance?w=60&h=60",
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
