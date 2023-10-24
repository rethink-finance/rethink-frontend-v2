<template>
  <v-img
    src="~/assets/images/rethink finance_ logo.png"
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
