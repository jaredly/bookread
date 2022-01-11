import React from 'react';
import {
    Button,
    StyleSheet,
    Text,
    View,
    PermissionsAndroid,
} from 'react-native';
import TTs from 'react-native-tts';
import {
    copyFile,
    ExternalDirectoryPath,
    ExternalStorageDirectoryPath,
    readdir,
} from 'react-native-fs';
import { FileBrowser } from './FileBrowser';

export default function App() {
    let [tick, setTick] = React.useState(0);
    const [progress, setProgress] = React.useState(null);
    const [error, setError] = React.useState(null);
    React.useEffect(() => {
        const fn = () => {
            setTick((tick) => tick + 1);
            setProgress(null);
        };
        TTs.addEventListener('tts-finish', fn);
        const cancel = (err) => setError(err || 'Some cancel');
        TTs.addEventListener('tts-cancel', cancel);
        const error = (err) => setError(err || 'Some error');
        TTs.addEventListener('tts-error', error);
        const f2 = (evt) => setProgress(evt);
        TTs.addEventListener('tts-progress', f2);
        return () => {
            TTs.removeEventListener('tts-finish', fn);
            TTs.removeEventListener('tts-error', error);
            TTs.removeEventListener('tts-cancel', cancel);
            TTs.removeEventListener('tts-progress', f2);
        };
    }, []);
    React.useEffect(() => {
        PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            {
                title: 'Book to Audio',
                message:
                    'Book to Audio needs access to your external storage so it can read ebooks.',
                buttonNeutral: 'Ask Me Later',
                buttonNegative: 'Cancel',
                buttonPositive: 'OK',
            },
        );
    }, []);

    const [pick, setPick] = React.useState(false);

    if (pick) {
        return (
            <View style={styles.container}>
                <FileBrowser
                    onSelect={() => {
                        setPick(false);
                    }}
                    filter={(item) =>
                        item.isDirectory() || item.name.endsWith('.epub')
                    }
                />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text>Open up App.tsx to start working on your app!</Text>
            <Text>Love it {JSON.stringify(progress)}</Text>
            <Text>Error {JSON.stringify(error)}</Text>
            <Button
                title="Pick a file"
                onPress={() => {
                    setPick(true);
                }}
            />
            <Button
                title="Hello folks"
                onPress={() => {
                    TTs.getInitStatus().then(() => {
                        TTs.speak('Hello, world!');
                    });
                }}
            />
            <Text>Tick {tick}</Text>
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
