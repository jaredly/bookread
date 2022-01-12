import React, { useState } from 'react';
import {
    Button,
    StyleSheet,
    Text,
    View,
    PermissionsAndroid,
    Linking,
    ScrollView,
} from 'react-native';
import TTs from 'react-native-tts';
import {
    copyFile,
    ExternalDirectoryPath,
    ExternalStorageDirectoryPath,
    readdir,
} from 'react-native-fs';
import DocumentPicker from 'react-native-document-picker';
import AsyncStorage from '@react-native-community/async-storage';
import { basename, BookWhatsit } from './BookWhatsit';

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

export type Screen =
    | {
          id: 'home';
      }
    | { id: 'book'; path: string };

export const usePersistedState = <T,>(
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

export default function App() {
    React.useEffect(() => {
        PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
            permissionsConfig,
        );
    }, []);

    const [target, setTarget] = usePersistedState(null, 'target-dir');
    const [file, setFile] = usePersistedState(null, 'current-file');
    const [error, setError] = useState(null);

    const [recents, setRecents] = usePersistedState([], 'recent-files');

    React.useEffect(() => {
        if (file && !recents.includes(file)) {
            setRecents(recents.concat([file]));
        }
    }, [file]);

    if (target && file) {
        return (
            <View style={styles.container}>
                <BookWhatsit
                    path={file}
                    target={target}
                    onBack={(err) => {
                        setFile(null);
                        if (err) {
                            setError(err);
                        }
                    }}
                />
            </View>
        );
    }

    if (!target) {
        return (
            <View style={styles.container}>
                <Text>Pick target directory to store audiobooks:</Text>
                <Button
                    title="Pick a target directory"
                    onPress={() => {
                        DocumentPicker.pickDirectory({}).then((path) => {
                            setTarget(path.uri);
                        });
                    }}
                />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text>Target directory {target}</Text>
            <Button
                title="Pick a different target directory"
                onPress={() => {
                    DocumentPicker.pickDirectory({}).then((path) => {
                        setTarget(path.uri);
                    });
                }}
            />
            <View style={{ height: 16 }} />
            <Text>Pick an .epub file to record!</Text>
            <Button
                title="Pick a .epub file"
                onPress={() => {
                    DocumentPicker.pickSingle({
                        type: ['application/epub+zip'],
                    }).then((path) => {
                        setFile(path.uri);
                        setError(null);
                    });
                }}
            />
            {error ? <Text>Failed to load epub: {error.message}</Text> : null}
            <View style={{ height: 16 }} />
            <Text style={{ fontWeight: 'bold' }}>Recent files</Text>
            <ScrollView style={{ flex: 1 }}>
                {!recents.length ? <Text>No recent files...</Text> : null}
                {recents.map((name, i) => (
                    <Button
                        title={basename(decodeURIComponent(name))}
                        key={i}
                        onPress={() => {
                            // DocumentPicker.pickSingle({
                            //     uri: name,
                            // })
                            setFile(name);
                            setError(null);
                        }}
                    />
                ))}
            </ScrollView>
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
