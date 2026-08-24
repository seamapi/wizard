<script setup lang="ts">
const NAV_LINKS = [
  { to: '/', label: 'Book a stay' },
  { to: '/reservations', label: 'Reservations' },
  { to: '/spaces', label: 'Spaces' },
  { to: '/guests', label: 'Guests' },
]
</script>

<template>
  <div class="app">
    <header class="site-header">
      <div class="page-wrap">
        <NuxtLink to="/" class="brand">
          <span class="brand-mark">⚓</span>
          <span class="brand-name">Harbor PMS</span>
        </NuxtLink>
        <nav class="nav">
          <NuxtLink
            v-for="link in NAV_LINKS"
            :key="link.to"
            :to="link.to"
            class="nav-link"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>
      </div>
    </header>

    <main class="app-main">
      <slot />
    </main>

    <footer class="site-footer">
      <div class="page-wrap">
        Harbor PMS — a minimal property reservation manager.
      </div>
    </footer>
  </div>
</template>
