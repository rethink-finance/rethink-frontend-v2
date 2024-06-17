<template lang="html">
  <section class="page-redirect">
    <nuxt-link :to="url"> Redirecting to governance tab... </nuxt-link>
  </section>
</template>

<script>
export default {
  data() {
    return {
      url: "../",
    };
  },
  mounted() {
    this.$router.push(this.url);
  },
};
</script>
<style lang="scss" scoped>
.page-redirect {
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  justify-content: center;
  align-content: center;
  align-items: center;
}
</style>
