const { withAppBuildGradle } = require('expo/config-plugins')

/**
 * Config plugin que adiciona abiFilters no build.gradle do Android.
 * Remove x86 e x86_64 (emuladores) mantendo apenas arm64-v8a e armeabi-v7a
 * (dispositivos reais Android 32-bit e 64-bit).
 */
module.exports = function withAbiFilters(config, { abiFilters = ['arm64-v8a', 'armeabi-v7a'] } = {}) {
  return withAppBuildGradle(config, (cfg) => {
    const gradle = cfg.modResults.contents

    // Evita duplicar se já aplicado
    if (gradle.includes('abiFilters')) {
      return cfg
    }

    const filters = abiFilters.map(a => `"${a}"`).join(', ')
    const insertion = `\n        ndk {\n            abiFilters ${filters}\n        }`

    cfg.modResults.contents = gradle.replace(
      /defaultConfig\s*\{/,
      `defaultConfig {${insertion}`
    )

    return cfg
  })
}
