/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer, webpack }) => {
    // Handle Node.js modules in the browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        assert: false,
        http: false,
        https: false,
        os: false,
        url: false,
        zlib: false,
        debug: false,
        util: false,
        buffer: 'buffer',
        events: false,
      }
      
      // Add buffer polyfill
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
        })
      )
      
      // Handle Cloudflare sockets scheme
      config.module.rules.push({
        test: /cloudflare:sockets/,
        use: 'null-loader'
      })
    }
    
    // Enable WebAssembly
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      syncWebAssembly: true,
    }
    
    return config
  }
}

export default nextConfig
