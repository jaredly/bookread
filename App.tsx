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
import DocumentPicker from 'react-native-document-picker';
import { basename, BookWhatsit } from './BookWhatsit';
import { usePersistedState } from './usePersistedState';

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
        'android.permission.MANAGE_EXTERNAL_STORAGE',
        // PermissionsAndroid.PERMISSIONS.MANAGE_EXTERNAL_STORAGE,
    );
    if (!perm) {
        console.warn('not granted');
        const res = await PermissionsAndroid.request(
            'android.permission.MANAGE_EXTERNAL_STORAGE',
            // PermissionsAndroid.PERMISSIONS.MANAGE_EXTERNAL_STORAGE,
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
