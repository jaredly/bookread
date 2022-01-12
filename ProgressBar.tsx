import React from 'react';
import { View } from 'react-native';

export const ProgressBar = ({
    total,
    current,
    fg,
    bg,
    width = 200,
}: {
    width?: number;
    total: number;
    current: number;
    fg: string;
    bg: string;
}) => {
    return (
        <View
            style={{
                height: 10,
                width,
                alignSelf: 'stretch',
                backgroundColor: bg,
            }}
        >
            <View
                style={{
                    height: 10,
                    width: width * (current / total),
                    backgroundColor: fg,
                    alignSelf: 'flex-start',
                }}
            />
        </View>
    );
};
