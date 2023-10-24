<template>
  <v-img
    src="https://cdn.vuetifyjs.com/images/parallax/material.jpg"
    contain
    :width="100"
    aspect-ratio="16/9"
  >
    <template v-slot:placeholder>
      <div class="d-flex align-center justify-center fill-height">
        <v-progress-circular
          color="grey-lighten-4"
          indeterminate
        ></v-progress-circular>
      </div>
    </template>
  </v-img>
</template>
