<template>
  <v-toolbar color="transparent" class="">
    <v-avatar size="50" rounded="0" class="me-2">
      <img
        cover
        :src="
          props.image || 'https://api.lorem.space/image/finance?w=150&h=150'
        "
      />
    </v-avatar>
    <v-card
      color="transparent"
      class="d-flex pa-1 transparent align-items-center"
      flat
    >
      <div class="title-wrapper">
        <h4>{{ title }}</h4>
        <h5>{{ subtitle }}</h5>
      </div>
    </v-card>
  </v-toolbar>
</template>

<script setup lang="ts">
const props = defineProps({
  image: String,
  title: String,
  subtitle: String,
});
</script>

<style scoped>
.title-wrapper {
  justify-content: center;
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

h4 {
  font-size: 14px;
  font-style: normal;
  font-weight: 700;
  line-height: 150%; /* 21px */
  letter-spacing: 0.84px;
  text-transform: uppercase;
}

h5 {
  /* font-family: Eudoxus Sans; */
  color: #afb6c8;
  font-size: 14px;
  font-style: normal;
  font-weight: 700;
  line-height: 150%; /* 21px */
  letter-spacing: 0.84px;
}
</style>
