module.exports = function (api) {
  api.cache(true);

  return {
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }], 'nativewind/babel'],

    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],

          alias: {
            '@': './',
            'tailwind.config': './tailwind.config.js',
          },
        },
      ],
      'react-native-worklets/plugin',
    ],
  };
};
