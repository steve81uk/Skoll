import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@tensorflow')) return 'vendor-ml'
            if (id.includes('@xterm') || id.includes('xterm')) return 'vendor-xterm'
            if (id.includes('recharts')) return 'vendor-charts'
            if (id.includes('framer-motion') || id.includes('gsap') || id.includes('lucide-react')) return 'vendor-ui'
            if (id.includes('three')) return 'vendor-three'
            if (id.includes('@react-three/fiber') || id.includes('@react-three/drei') || id.includes('@react-three/postprocessing') || id.includes('postprocessing')) {
              return 'vendor-r3f'
            }
            if (id.includes('react') || id.includes('scheduler')) return 'vendor-react'
            return 'vendor-misc'
          }

        },
      },
    },
  },
})
