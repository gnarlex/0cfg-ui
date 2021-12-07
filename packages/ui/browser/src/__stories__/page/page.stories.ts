import 'reflect-metadata';
import {Story, Meta} from '@storybook/web-components';
import {dependencyContainer} from './inversify.config';
import {types} from './types';

export default {
    title: 'Page',
} as Meta;

const Template: Story<Partial<any>> = () => dependencyContainer.get(types.MainPage);

export const Default = Template.bind({});
Default.args = {
    user: {},
};
