import 'reflect-metadata';
import {Story, Meta} from '@storybook/web-components';
import {dependencyContainer} from './inversify.config';
import {types} from './types';

export default {
    title: 'File Tree',
} as Meta;

const Template: Story<Partial<any>> = () => dependencyContainer.get(types.FileTree);

export const Default = Template.bind({});
Default.args = {
    user: {},
};
