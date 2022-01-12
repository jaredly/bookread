import React from 'react';
import { Button, Text, View } from 'react-native';
import TTs from 'react-native-tts';
import {
    exists,
    ExternalStorageDirectoryPath,
    mkdir,
    writeFile,
} from 'react-native-fs';
import AsyncStorage from '@react-native-community/async-storage';
import { useKeepAwake } from 'expo-keep-awake';
import { useTTSProgress } from './useTTSProgress';
import { ProgressBar } from './ProgressBar';
import {
    ChapterData,
    Chapter,
    loadBook,
    runTranscription,
    ShowChapters,
} from './ShowChapters';
import { FFmpegKit } from 'ffmpeg-kit-react-native';
import { getWritePermission } from './App';

export const basename = (path: string) => {
    const parts = path.split('/');
    return parts[parts.length - 1];
};
export const dirname = (path: string) => path.split('/').slice(0, -1).join('/');

const statusKey = (path: string, target: string) =>
    `last-completed:${path}:${target}`;

export const KeepAwake = () => {
    useKeepAwake();

    return null;
};

export const BookWhatsit = ({
    path,
    onBack,
    target,
}: {
    path: string;
    target: string;
    onBack: (err?: Error) => void;
}) => {
    const [keepAwake, setKeepAwake] = React.useState(false);
    const map = React.useRef(null as null | ChapterData);
    const [lastCompleted, setLastCompleted] = React.useState(
        null as null | number,
    );
    const [chapters, setChapters] = React.useState(
        null as null | Array<Chapter>,
    );
    const [progress, error] = useTTSProgress((evt) => {
        AsyncStorage.setItem(
            statusKey(path, target),
            map.current.mapping[evt.utteranceId].toString(),
        );
        setLastCompleted(map.current.mapping[evt.utteranceId]);
    });
    const [started, setStarted] = React.useState(false);
    // const [data, setData] = React.useState(null as null | string);
    React.useEffect(() => {
        (async () => {
            let last = await AsyncStorage.getItem(statusKey(path, target));
            setLastCompleted(last != null ? +last : -1);
            try {
                const chapters = await loadBook(path);
                setChapters(chapters);
            } catch (err) {
                onBack(err);
            }
        })().catch((err) => {
            console.error(err);
        });
    }, []);

    if (!chapters) {
        return (
            <View>
                <Text>Loading .epub file...</Text>
            </View>
        );
    }

    // TODO: use 'target' here actually
    const base =
        ExternalStorageDirectoryPath +
        '/Audiobooks/' +
        basename(path).replace(/\.epub$/, '');

    const totalBlobs = chapters.reduce((t, c) => t + c.blobs.length, 0);

    return (
        <View style={{ alignSelf: 'center', padding: 16 }}>
            <View
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                }}
            >
                {lastCompleted >= totalBlobs - 1 ? (
                    <Button
                        title="Consolidate into chapters!"
                        onPress={async () => {
                            const text = chapters[0].blobs
                                .map((_, i) => `${i}.wav`)
                                .join('\n');
                            await getWritePermission();
                            if (!(await exists(base))) {
                                await mkdir(base);
                                console.warn('base doesnt exist');
                            }
                            // const file = base + '/ch1.txt';
                            const file =
                                ExternalStorageDirectoryPath +
                                '/Audiobooks' +
                                '/ch1.txt';
                            try {
                                await writeFile(file, text);
                            } catch (err) {
                                console.log('failed to write file');
                                console.error(err);
                                return;
                            }
                            try {
                                await FFmpegKit.execute(
                                    `-f concat -safe 0 -i ${file} -c copy ${
                                        base + '/ch1.mp3'
                                    }`,
                                );
                            } catch (err) {
                                console.error(err);
                            }
                        }}
                    />
                ) : null}
                <Button
                    title="Back"
                    onPress={() => {
                        onBack();
                    }}
                />
                <View style={{ flexBasis: 8 }} />
                {started && lastCompleted < totalBlobs - 1 ? (
                    <Button
                        title="Stop"
                        onPress={() => {
                            TTs.stop();
                            setStarted(false);
                        }}
                    />
                ) : (
                    <Button
                        title="Start"
                        onPress={() => {
                            setStarted(true);
                            runTranscription(
                                base,
                                chapters!,
                                map,
                                lastCompleted + 1,
                            ).catch((err) => {
                                console.error(err);
                            });
                        }}
                    />
                )}
                <View style={{ flexBasis: 8 }} />
                {started ? (
                    keepAwake ? (
                        <>
                            <Button
                                title="Turn off keep awake"
                                onPress={() => setKeepAwake(false)}
                                color={'red'}
                            />
                            <KeepAwake />
                        </>
                    ) : (
                        <Button
                            title="Keep awake"
                            onPress={() => setKeepAwake(true)}
                        />
                    )
                ) : null}
            </View>
            <View style={{ height: 8 }} />
            <Text>File: {basename(decodeURIComponent(path))}</Text>
            <View style={{ height: 8 }} />
            <ProgressBar
                bg="#afa"
                fg="#0f0"
                current={(lastCompleted ?? -1) + 1}
                total={totalBlobs}
            />
            <View style={{ height: 8 }} />
            <ProgressBar
                bg="#aaf"
                fg="#00f"
                current={progress?.end ?? 0}
                total={
                    map.current && progress?.utteranceId
                        ? map.current.full[
                              map.current.mapping[progress.utteranceId]
                          ].length
                        : 100
                }
            />
            <View style={{ height: 8 }} />
            {lastCompleted != null ? (
                <Text>
                    {(((lastCompleted + 1) / totalBlobs) * 100).toFixed(2) +
                        '%   '}
                    {lastCompleted + 1} of {totalBlobs}
                </Text>
            ) : null}
            {error ? (
                <Text>
                    Error {JSON.stringify(error)}
                    {error.utteranceId
                        ? JSON.stringify(
                              map.current.full[
                                  map.current.mapping[error.utteranceId]
                              ],
                          ) +
                          ` ok ${error.utteranceId} ${
                              map.current.mapping[error.utteranceId]
                          }`
                        : 'No utteranceid'}
                </Text>
            ) : null}
            <View style={{ height: 16 }} />
            <Button
                onPress={() => {
                    AsyncStorage.removeItem(statusKey(path, target));
                    setLastCompleted(-1);
                    if (started) {
                        TTs.stop();
                        setStarted(false);
                    }
                }}
                title="Reset"
            />
            <View style={{ height: 16 }} />
            {chapters != null ? <ShowChapters chapters={chapters} /> : null}
        </View>
    );
};
