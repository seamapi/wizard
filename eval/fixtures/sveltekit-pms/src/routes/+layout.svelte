<script lang="ts">
  import { page } from '$app/state'
  import '../app.css'

  let { children } = $props()

  const NAV_LINKS: Array<{ href: string; label: string; exact?: boolean }> = [
    { href: '/', label: 'Book a stay', exact: true },
    { href: '/reservations', label: 'Reservations' },
    { href: '/spaces', label: 'Spaces' },
    { href: '/guests', label: 'Guests' },
  ]

  const isActive = (href: string, exact?: boolean) =>
    exact ? page.url.pathname === href : page.url.pathname.startsWith(href)
</script>

<div class="app-shell">
  <header class="site-header">
    <div class="page-wrap">
      <a href="/" class="brand">
        <span class="brand-mark">⚓</span>
        <span class="brand-name">Harbor PMS</span>
      </a>
      <nav class="nav">
        {#each NAV_LINKS as link (link.href)}
          <a
            href={link.href}
            class="nav-link"
            class:is-active={isActive(link.href, link.exact)}
          >
            {link.label}
          </a>
        {/each}
      </nav>
    </div>
  </header>

  <main>
    {@render children()}
  </main>

  <footer class="site-footer">
    <div class="page-wrap">
      Harbor PMS — a minimal property reservation manager.
    </div>
  </footer>
</div>
