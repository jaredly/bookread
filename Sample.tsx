import React from 'react';
import { Button, View, PermissionsAndroid } from 'react-native';
import TTs from 'react-native-tts';
import {
    copyFile,
    ExternalDirectoryPath,
    ExternalStorageDirectoryPath,
    readdir,
} from 'react-native-fs';
import { getWritePermission } from './App';

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
