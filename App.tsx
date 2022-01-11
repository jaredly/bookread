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

export const BookWhatsit = ({ path }: { path: string }) => {
    const map = React.useRef(null);
    const [lastCompleted, setLastCompleted] = React.useState(
        null as null | number,
    );
    const [progress, error] = useTTSProgress((evt) => {
        AsyncStorage.setItem(
            'last-completed',
            map.current.mapping[evt.utteranceId].toString(),
        );
        setLastCompleted(map.current.mapping[evt.utteranceId]);
    });
    // const [data, setData] = React.useState(null as null | string);

    React.useEffect(() => {
        readFile(path, 'base64').then((blob) => {
            // console.log('BLob', blob.slice(0, 100));
            JSZip.loadAsync(blob, { base64: true })
                .then(async (file) => {
                    const found = Object.keys(file.files).find(
                        (x) => x.toLowerCase() === 'meta-inf/container.xml',
                    );
                    if (!found) {
                        console.log(Object.keys(file.files));
                        return;
                    }
                    const manifest = await file.files[found].async('string');
                    console.log(manifest);
                    const soup = new jssoup(manifest);
                    const roots = soup.findAll('rootfile');
                    console.log(roots);
                    const fileName = roots[0].attrs['full-path'];

                    const root = await file.files[fileName].async('string');
                    const rsoup = new jssoup(root);
                    console.log(root);
                    const items = rsoup.findAll('item');
                    const itemById: { [key: string]: string } = {};
                    items.forEach(
                        (item) =>
                            (itemById[item.attrs['id']] = item.attrs['href']),
                    );
                    console.log(itemById);
                    const spineEl = rsoup.find('spine');
                    const toc = await file.files[
                        itemById[spineEl.attrs['toc']]
                    ].async('string');
                    console.log(toc);
                    const tsoup = new jssoup(toc);
                    const points = tsoup.findAll('navPoint');
                    const chapters = points
                        .map((point) => {
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
                    // console.log(chapters);

                    for (let chapter of chapters) {
                        const contents = await file.files[chapter.src].async(
                            'string',
                        );
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

                        // console.log(soup.contents.map((m) => m.name));
                        // console.log(contents);
                        // break;

                        chapter.blobs = soup.contents
                            .filter((toplevel) => toplevel.text.trim().length)
                            .map((toplevel, i) => {
                                return toplevel.name === 'table'
                                    ? `Table with ${toplevel.contents.length} rows and ${toplevel.contents[0].contents.length} columns.`
                                    : toplevel.prettify();
                            });
                    }

                    console.log(
                        chapters.reduce(
                            (v, c) =>
                                v + c.blobs.reduce((v, t) => v + t.length, 0),
                            0,
                        ),
                        'characters to speak',
                        chapters.map((c) => c.blobs.length),
                        'chunks',
                        chapters.length,
                        'chapters',
                        chapters.reduce(
                            (m, c) =>
                                Math.max(
                                    c.blobs.reduce(
                                        (m, b) => Math.max(m, b.length),
                                        0,
                                    ),
                                ),
                            0,
                        ),
                    );

                    const base =
                        ExternalStorageDirectoryPath + '/Audiobooks/WIP';
                    if (!(await exists(base))) {
                        await mkdir(base);
                    }

                    const data: {
                        blobs: number;
                        idx: number;
                        mapping: { [key: string]: number };
                        lengths: { [key: number]: number };
                    } = (map.current = {
                        blobs: chapters.reduce((t, c) => t + c.blobs.length, 0),
                        idx: 0,
                        mapping: {},
                        lengths: {},
                    });

                    let last = await AsyncStorage.getItem('last-completed');
                    let skipTo = last != null ? +last : 0;
                    setLastCompleted(skipTo);

                    console.log('going through chapters');
                    let i = 0;
                    // let need = 0;
                    for (let chapter of chapters) {
                        for (let blob of chapter.blobs) {
                            let id = i++;
                            if (id < skipTo) {
                                continue;
                            }
                            const dest = base + `/${id}.wav`;
                            data.lengths[id] = blob.length;
                            // if (await exists(dest)) {
                            //     continue;
                            // }
                            // need++;
                            // console.log(blob);
                            const uid = await TTs.speakToFile(blob, dest);
                            data.mapping[uid] = id;
                        }
                    }
                    // console.log('gone', need);

                    // const spine = spineEl.findAll('itemref').map((ref) => {
                    //     return itemById[ref.attrs['idref']];
                    // });
                    // console.log(spine);
                    // const first = spine[1];
                    // const firstData = await file.files['toc.ncx'].async(
                    //     'string',
                    // );
                    // console.log(firstData);
                    // const obj = {
                    //     names: Object.keys(file.files),
                    //     count: Object.keys(file.files).length,
                    //     readFile: (name, cb) => {
                    //         file.files[name]
                    //             .async('text')
                    //             .then((data) => cb(null, data))
                    //             .catch((err) => cb(err));
                    //     },
                    // };
                    // const ep = new Epub(obj);
                    // ep.parse();
                    // ep.on('error', (data) => {
                    //     console.log('Failed to epub');
                    //     console.error(data);
                    // });
                    // await new Promise((res) => ep.on('end', res));
                    // for (let chapter of ep.flow) {
                    //     console.log(chapter.id);
                    // }
                    // setData(ep);
                })
                .catch((err) => {
                    console.log('Fail');
                    console.error(err);
                });
        });
    }, []);

    return (
        <View style={{ alignSelf: 'center' }}>
            <Text>Hello</Text>
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
                            map.current && lastCompleted != null
                                ? 200 * (lastCompleted / map.current.blobs)
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
            {/* {progress ? <Text>Love it {JSON.stringify(progress)}</Text> : null} */}
            {lastCompleted != null && map.current ? (
                <Text>
                    {((lastCompleted / map.current.blobs) * 100).toFixed(2) +
                        '%   '}
                    {lastCompleted} of {map.current.blobs}
                </Text>
            ) : null}
            {error ? <Text>Error {JSON.stringify(error)}</Text> : null}
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
