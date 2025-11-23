import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Config for building the library
  if (mode === 'lib') {
    return {
      build: {
        lib: {
          entry: path.resolve(__dirname, 'src/utils/address-parse.ts'),
          name: 'AddressParse', // The global variable name in UMD build
          fileName: 'address-parse', // The base name for the output file
          formats: ['umd'], // Generate UMD format suitable for <script> tag
        },
        // The output directory for the library.
        outDir: 'dist/lib',
        // Minify the output. This is true by default for `vite build`.
        minify: true,
      },
    }
  }

  // Default config for app development/build
  return {
    plugins: [vue(), vueDevTools()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
