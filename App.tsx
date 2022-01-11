import React from 'react';
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
    exists,
    ExternalDirectoryPath,
    ExternalStorageDirectoryPath,
    mkdir,
    readdir,
    readFile,
} from 'react-native-fs';
import { FileBrowser } from './FileBrowser';
import DocumentPicker from 'react-native-document-picker';
import JSZip from 'jszip';
import jssoup from 'jssoup';
import AsyncStorage from '@react-native-community/async-storage';

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

type ChapterData = {
    blobs: number;
    idx: number;
    chapters: Array<{
        src: string;
        label: string;
        playOrder: number;
        blobs: Array<string>;
    }>;
    mapping: {
        [key: string]: number;
    };
    lengths: {
        [key: number]: number;
    };
};

export const BookWhatsit = ({ path }: { path: string }) => {
    const map = React.useRef(null as null | ChapterData);
    const [lastCompleted, setLastCompleted] = React.useState(
        null as null | number,
    );
    const [chapters, setChapters] = React.useState(
        null as null | Array<Chapter>,
    );
    const [progress, error] = useTTSProgress((evt) => {
        AsyncStorage.setItem(
            'last-completed:' + path,
            map.current.mapping[evt.utteranceId].toString(),
        );
        setLastCompleted(map.current.mapping[evt.utteranceId]);
    });
    const [started, setStarted] = React.useState(false);
    // const [data, setData] = React.useState(null as null | string);

    React.useEffect(() => {
        (async () => {
            let last = await AsyncStorage.getItem('last-completed:' + path);
            let skipTo = last != null ? +last + 1 : 0;
            setLastCompleted(skipTo - 1);
            const chapters = await loadBook(path);
            setChapters(chapters);
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

    const totalBlobs = chapters.reduce((t, c) => t + c.blobs.length, 0);

    return (
        <View style={{ alignSelf: 'center' }}>
            <Text>Hello</Text>
            {started ? (
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
                            chapters!,
                            map,
                            lastCompleted + 1,
                        ).catch((err) => {
                            console.error(err);
                        });
                    }}
                />
            )}
            <View
                style={{
                    height: 10,
                    width: 200,
                    alignSelf: 'stretch',
                    backgroundColor: '#afa',
                }}
            >
                <View
                    style={{
                        height: 10,
                        width:
                            lastCompleted != null
                                ? 200 * ((lastCompleted + 1) / totalBlobs)
                                : 0,
                        backgroundColor: '#0f0',
                        alignSelf: 'flex-start',
                    }}
                />
            </View>

            <View
                style={{
                    height: 10,
                    width: 200,
                    alignSelf: 'stretch',
                    backgroundColor: '#aaf',
                }}
            >
                <View
                    style={{
                        height: 10,
                        width:
                            map.current && progress?.utteranceId
                                ? 200 *
                                  (progress.end /
                                      map.current.lengths[
                                          map.current.mapping[
                                              progress.utteranceId
                                          ]
                                      ])
                                : 0,
                        backgroundColor: '#00f',
                        alignSelf: 'flex-start',
                    }}
                />
            </View>
            {lastCompleted != null ? (
                <Text>
                    {(((lastCompleted + 1) / totalBlobs) * 100).toFixed(2) +
                        '%   '}
                    {lastCompleted + 1} of {totalBlobs}
                </Text>
            ) : null}
            {error ? <Text>Error {JSON.stringify(error)}</Text> : null}
            <View style={{ height: 16 }} />
            <Button
                onPress={() => {
                    AsyncStorage.removeItem('last-completed');
                }}
                title="Reset"
            />
            <View style={{ height: 16 }} />
            {chapters != null ? <ShowChapters chapters={chapters} /> : null}
        </View>
    );
};

export const ShowChapters = ({
    chapters,
}: {
    chapters: ChapterData['chapters'];
}) => {
    const [show, setShow] = React.useState(false);
    const [idx, setIdx] = React.useState(0);
    return (
        <View style={show ? { flex: 1 } : null}>
            <Button
                onPress={() => setShow(!show)}
                title={show ? 'Hide text' : 'Show text'}
            />
            {show ? (
                <>
                    <View style={{ height: 16 }} />
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'center',
                        }}
                    >
                        <Button
                            onPress={() => setIdx(Math.max(0, idx - 1))}
                            title="<--"
                        />
                        <Text>{idx}</Text>
                        <Button
                            onPress={() =>
                                setIdx(Math.min(idx + 1, chapters.length - 1))
                            }
                            title="-->"
                        />
                    </View>

                    <ScrollView style={{ flex: 1 }}>
                        {chapters[idx].blobs.map((blob, i) => (
                            <View key={i}>
                                <Text>
                                    {i}. {blob}
                                </Text>
                            </View>
                        ))}
                    </ScrollView>
                </>
            ) : null}
        </View>
    );
};

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

const loadBook = async (path: string): Promise<Array<Chapter>> => {
    const blob = await readFile(path, 'base64');
    const file = await JSZip.loadAsync(blob, { base64: true });
    const found = Object.keys(file.files).find(
        (x) => x.toLowerCase() === 'meta-inf/container.xml',
    );
    if (!found) {
        console.log(Object.keys(file.files));
        return;
    }
    const chapters = await getChapters(file, found);

    for (let chapter of chapters) {
        await populateChapter(file, chapter);
    }

    return chapters;
};

async function runTranscription(
    chapters: Array<Chapter>,
    map: React.MutableRefObject<ChapterData>,
    skipTo: number,
) {
    // console.log(
    //     chapters.reduce(
    //         (v, c) =>
    //             v + c.blobs.reduce((v, t) => v + t.length, 0),
    //         0,
    //     ),
    //     'characters to speak',
    //     chapters.map((c) => c.blobs.length),
    //     'chunks',
    //     chapters.length,
    //     'chapters',
    //     chapters.reduce(
    //         (m, c) =>
    //             Math.max(
    //                 c.blobs.reduce(
    //                     (m, b) => Math.max(m, b.length),
    //                     0,
    //                 ),
    //             ),
    //         0,
    //     ),
    // );
    const base = ExternalStorageDirectoryPath + '/Audiobooks/WIP';
    if (!(await exists(base))) {
        await mkdir(base);
    }

    const data: ChapterData = (map.current = {
        blobs: chapters.reduce((t, c) => t + c.blobs.length, 0),
        idx: 0,
        mapping: {},
        lengths: {},
        chapters,
    });

    // let last = await AsyncStorage.getItem(
    //     'last-completed:' + path
    // );
    // let skipTo = last != null ? +last + 1 : 0;
    // setLastCompleted(skipTo - 1);

    console.log('going through chapters');
    let i = 0;
    for (let chapter of chapters) {
        for (let blob of chapter.blobs) {
            let id = i++;
            if (id < skipTo) {
                continue;
            }
            const dest = base + `/${id}.wav`;
            data.lengths[id] = blob.length;
            const uid = await TTs.speakToFile(blob, dest);
            data.mapping[uid] = id;
        }
    }
}

async function populateChapter(file: JSZip, chapter: any) {
    const contents = await file.files[chapter.src].async('string');
    let soup = new jssoup(contents);
    const body = soup.find('body');
    if (body) {
        soup = body;
    }
    soup.findAll('sup').forEach((sup) => {
        sup.extract();
    });
    soup.findAll('span').forEach((span) => {
        span.replaceWith(span.text);
    });

    soup.findAll('div').forEach((div) => {
        if (!div.attrs.class) {
            return;
        }
        if (div.attrs.class.startsWith('blockquote')) {
            div.insert(0, 'Quote: ');
        }
        if (div.attrs.class === 'head') {
            div.insert(0, 'Heading: ');
            div.append(new jssoup('.'));
        }
    });

    chapter.blobs = soup.contents
        .filter((toplevel) => toplevel.text.trim().length)
        .map((toplevel, i) => {
            return toplevel.name === 'table'
                ? `Table with ${toplevel.contents.length} rows and ${toplevel.contents[0].contents.length} columns.`
                : toplevel.text;
        });
}
type Chapter = {
    src: string;
    label: string;
    playOrder: number;
    class: string;
    blobs: string[];
};

async function getChapters(
    file: JSZip,
    found: string,
): Promise<Array<Chapter>> {
    const manifest = await file.files[found].async('string');
    // console.log(manifest);
    const soup = new jssoup(manifest);
    const roots = soup.findAll('rootfile');
    // console.log(roots);
    const fileName = roots[0].attrs['full-path'];

    const root = await file.files[fileName].async('string');
    const rsoup = new jssoup(root);
    // console.log(root);
    const items = rsoup.findAll('item');
    const itemById: { [key: string]: string } = {};
    items.forEach((item) => (itemById[item.attrs['id']] = item.attrs['href']));
    // console.log(itemById);
    const spineEl = rsoup.find('spine');
    const toc = await file.files[itemById[spineEl.attrs['toc']]].async(
        'string',
    );
    // console.log(toc);
    const tsoup = new jssoup(toc);
    const points = tsoup.findAll('navPoint');

    const chapters = points
        .map((point): Chapter => {
            const src = point.find('content').attrs['src'];
            const label = point.find('navLabel').text;
            return {
                src,
                label,
                playOrder: +point.attrs['playOrder'],
                class: point.attrs['class'],
                blobs: [],
            };
        })
        .filter((item) => item.class === 'chapter');
    return chapters;
}
