import React from 'react';
import {
    Button,
    StyleSheet,
    Text,
    View,
    PermissionsAndroid,
    Linking,
} from 'react-native';
import TTs from 'react-native-tts';
import {
    copyFile,
    ExternalDirectoryPath,
    ExternalStorageDirectoryPath,
    readdir,
} from 'react-native-fs';
import { FileBrowser } from './FileBrowser';
import DocumentPicker from 'react-native-document-picker';
import AsyncStorage from '@react-native-community/async-storage';
import { BookWhatsit } from './BookWhatsit';

export const Sample = () => {
    return (
        <View>
            <Button
                title="Hello folks"
                onPress={() => {
                    TTs.getInitStatus().then(() => {
                        TTs.speak('Hello, world!');
                    });
                }}
            />
            <Button
                title="Check"
                onPress={() => {
                    readdir(ExternalStorageDirectoryPath).then((data) => {
                        alert(JSON.stringify(data));
                    });
                }}
            />
            <Button
                title="Copy it over"
                onPress={async () => {
                    const perm = await PermissionsAndroid.check(
                        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
                    );
                    console.warn('perm', perm);
                    const perm2 = await PermissionsAndroid.check(
                        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
                    );
                    console.warn('perm2', perm2);
                    if (!perm) {
                        console.warn('not granted');
                        const res = await PermissionsAndroid.request(
                            PermissionsAndroid.PERMISSIONS
                                .WRITE_EXTERNAL_STORAGE,
                        );
                        if (res !== 'granted') {
                            console.warn('nope', res);
                            return;
                        }
                    }
                    await copyFile(
                        ExternalDirectoryPath + '/out.wav',
                        ExternalStorageDirectoryPath + '/Audiobooks/out.wav',
                    );
                    alert('ok');
                }}
            />
            <Button
                title="Write it out!"
                onPress={async () => {
                    if (!(await getWritePermission())) {
                        return;
                    }
                    const target =
                        ExternalStorageDirectoryPath + '/Audiobooks/out2.wav';
                    TTs.speakToFile('Hello my good folks!', target)
                        .catch((err) => {
                            console.warn('failed folks', target);
                        })
                        .then(() => {
                            console.warn('ok?', target);
                        });
                }}
            />
        </View>
    );
};

const permissionsConfig = {
    title: 'Book to Audio',
    message:
        'Book to Audio needs access to your external storage so it can read ebooks.',
    buttonNeutral: 'Ask Me Later',
    buttonNegative: 'Cancel',
    buttonPositive: 'OK',
};

export const useTTSProgress = (onFinish) => {
    const [progress, setProgress] = React.useState(null);
    const [error, setError] = React.useState(null);
    React.useEffect(() => {
        const fn = (evt) => {
            onFinish(evt);
            // setTick((tick) => tick + 1);
            setProgress(null);
        };
        TTs.addEventListener('tts-finish', fn);
        const cancel = (err) => setError(err || 'Some cancel');
        TTs.addEventListener('tts-cancel', cancel);
        const error = (err) => setError(err || 'Some error');
        TTs.addEventListener('tts-error', error);
        const f2 = (evt) =>
            setProgress((prev) =>
                prev ? { ...evt, tick: prev.tick + 1 } : { ...evt, tick: 0 },
            );
        TTs.addEventListener('tts-progress', f2);
        return () => {
            TTs.removeEventListener('tts-finish', fn);
            TTs.removeEventListener('tts-error', error);
            TTs.removeEventListener('tts-cancel', cancel);
            TTs.removeEventListener('tts-progress', f2);
        };
    }, []);

    return [progress, error];
};

export type Screen =
    | {
          id: 'home';
      }
    | { id: 'pick' }
    | { id: 'book'; path: string };

export default function App() {
    React.useEffect(() => {
        PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
            permissionsConfig,
        );
        // PermissionsAndroid.request(
        //     PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        //     permissionsConfig,
        // );
    }, []);

    const [screen, setScreen] = React.useState({ id: 'home' } as Screen);

    React.useEffect(() => {
        AsyncStorage.getItem('last-file').then((v) => {
            if (v) {
                setScreen({ id: 'book', path: v });
            }
        });
    }, []);
    React.useEffect(() => {
        if (screen.id === 'book') {
            AsyncStorage.setItem('last-file', screen.path);
        }
    }, [screen]);

    if (screen.id === 'pick') {
        return (
            <View style={styles.container}>
                <FileBrowser
                    onSelect={(item) => {
                        setScreen({ id: 'book', path: item.path });
                    }}
                    filter={
                        (item) => true
                        // item.isDirectory() || item.path.toLowerCase().includes('subtle')
                    }
                />
            </View>
        );
    }

    if (screen.id === 'book') {
        return (
            <View style={styles.container}>
                <BookWhatsit path={screen.path} />
                {/* <Text>Here we are folks!</Text>
                <Text>{screen.path}</Text> */}
                <Button
                    title="Back"
                    onPress={() => {
                        setScreen({ id: 'home' });
                    }}
                />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text>Pick an .epub file to get started!</Text>
            <Button
                title="Pick a new file"
                onPress={() => {
                    DocumentPicker.pickSingle({
                        type: ['application/epub+zip'],
                    }).then((path) => {
                        setScreen({ id: 'book', path: path.uri });
                    });
                }}
            />
            <Button
                title="Pick a file"
                onPress={() => {
                    setScreen({ id: 'pick' });
                }}
            />
        </View>
    );
}

export const getWritePermission = async () => {
    const perm = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    );
    if (!perm) {
        console.warn('not granted');
        const res = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        );
        if (res !== 'granted') {
            console.warn('nope', res);
            return false;
        }
    }
    return true;
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
