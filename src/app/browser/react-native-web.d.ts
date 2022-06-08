declare module 'react-native-web' {
    export {};

    import React from 'react';
    import { ViewProps, ViewStyle } from 'react-native';

    export interface CheckBoxProps extends ViewProps {
        /**
         * Set the background color of the checkbox.
         * @default "#AAB8C2"
         */
        color?: string;
        /**
         * Prevent all interactions with the checkbox.
         */
        disabled?: boolean;
        /**
         * Called when the state of the native checkbox changes.
         */
        onChange?: (e: ChangeEvent) => void;
        /**
         * Called when the state of the native checkbox changes.
         */
        onValueChange?: (value: boolean | 'mixed') => void;
        /**
         * Set the value of the checkbox.
         * @default false
         */
        value?: boolean | 'mixed';
    }

    export class CheckBox extends React.Component<CheckBoxProps> {}

    export interface PickerItemProps<T = number | string> {
        /**
         * Color of the item label. (Limited by browser support.)
         */
        color?: string;
        /**
         * Text to display for this item.
         */
        label?: string;
        /**
         * Used to locate this view in end-to-end tests.
         */
        testID?: string;
        /**
         * The value to be passed to the picker’s onValueChange callback when this item is selected.
         */
        value?: T;
    }

    declare class PickerItem<T = number | string> extends React.Component<PickerItemProps<T>> {}

    export interface PickerStyle extends ViewStyle {
        color?: string;
    }
    export interface PickerProps<T = number | string> extends ViewProps {
        /**
         * The items to display in the picker must be of type Picker.Item.
         */
        children?: React.ReactElement<PickerItemProps<T>, PickerItem> |
            React.ReactElement<PickerItemProps<T>, PickerItem>[];
        /**
         * Determines if the picker will be disabled, i.e., the user will not be able to make a selection.
         * @default true
         */
        enabled?: boolean;
        /**
         * Callback for when an item is selected. This is called with the value and index prop of the item that was selected.
         */
        onValueChange?: (value: string, index: number) => void;
        /**
         * Select the item with the matching value.
         */
        selectedValue?: T;
        /**
         * Supported style properties.
         */
        style?: StyleProp<PickerStyle>;
    }

    export class Picker<T = number | string> extends React.Component<PickerProps<T>> {
        static Item = PickerItem<T>;
    }
    export namespace Picker {
        type Item<T = number | string> = PickerItem<T>;
    }
}
