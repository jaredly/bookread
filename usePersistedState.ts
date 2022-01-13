import * as React from 'react';
import AsyncStorage from '@react-native-community/async-storage';

export const usePersistedState = <T>(
    initial: T,
    key: string,
): [T, (v: T) => void] => {
    const [v, setV] = React.useState(initial);
    React.useEffect(() => {
        AsyncStorage.getItem(key).then((v) => {
            if (v) {
                setV(JSON.parse(v));
            }
        });
    }, []);
    React.useEffect(() => {
        AsyncStorage.setItem(key, JSON.stringify(v));
    }, [v]);
    return [v, setV];
};
