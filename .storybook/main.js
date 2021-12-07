module.exports = {
    stories: [
        '../packages/ui/browser/src/__stories__/**/*.stories.@(js|jsx|ts|tsx)'
    ],
    addons: [
        '@storybook/addon-links',
        '@storybook/addon-essentials'
    ],
    babel: async (options) => {
        options.plugins.push(require.resolve('babel-plugin-transform-typescript-metadata'));

        return options;
    }
}
