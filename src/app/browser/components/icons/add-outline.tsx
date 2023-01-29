import React from 'react';
import { Platform, Text } from 'react-native';
import { svg_styles } from './util.js';

const IconWeb = React.memo((props: {
    title?: string;
}) => <Text>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style={svg_styles}>
        {props.title ? <title>{props.title}</title> : null}
        <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32" d="M256 112v288M400 256H112"/>
    </svg>
</Text>);

export default Platform.OS === 'web' ? IconWeb : React.memo(() => null);
