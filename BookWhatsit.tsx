import React from 'react';
import { Button, Text, View, ScrollView } from 'react-native';
import TTs from 'react-native-tts';
import {
    exists,
    ExternalStorageDirectoryPath,
    mkdir,
    readFile,
} from 'react-native-fs';
import JSZip from 'jszip';
import jssoup from 'jssoup';
import AsyncStorage from '@react-native-community/async-storage';
import { useKeepAwake } from 'expo-keep-awake';

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

    const totalBlobs = chapters.reduce((t, c) => t + c.blobs.length, 0);

    return (
        <View style={{ alignSelf: 'center' }}>
            <Button
                title="Back"
                onPress={() => {
                    onBack();
                }}
            />
            <View style={{ height: 8 }} />
            <Text>File: {basename(decodeURIComponent(path))}</Text>
            <View style={{ height: 8 }} />
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
                        // TODO: use 'target' here actually
                        const base =
                            ExternalStorageDirectoryPath +
                            '/Audiobooks/' +
                            basename(path).replace(/\.epub$/, '');
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
            <View style={{ height: 8 }} />
            {/* <View
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
            </View> */}
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
            {/* <View
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
            </View> */}
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
    full: {
        [key: number]: string;
    };
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
    target: string,
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
    // const base = ExternalStorageDirectoryPath + '/Audiobooks/' + target;
    const base = target;
    if (!(await exists(base))) {
        await mkdir(base);
    }

    const data: ChapterData = (map.current = {
        blobs: chapters.reduce((t, c) => t + c.blobs.length, 0),
        idx: 0,
        mapping: {},
        full: {},
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
            data.full[id] = blob;
            const uid = await TTs.speakToFile(blob, dest).catch((err) => {
                if (err.utteranceId) {
                    data.mapping[err.utteranceId] = id;
                }
                console.log(`ok failed here`, blob, dest, err, blob.length);
                throw err;
            });
            data.mapping[uid] = id;
        }
    }
}

async function populateChapter(
    file: JSZip,
    chapter: { src: string; blobs: Array<string> },
) {
    if (!file.files[chapter.src]) {
        throw new Error(
            `Chapter not in files list ${chapter.src} - ${Object.keys(
                file.files,
            )}`,
        );
    }
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

    chapter.blobs = (
        soup.contents
            .filter((toplevel) => toplevel.text.trim().length)
            .map((toplevel, i) => {
                return toplevel.name === 'table'
                    ? `Table with ${toplevel.contents.length} rows and ${toplevel.contents[0].contents.length} columns.`
                    : toplevel.text;
            }) as Array<string>
    )
        .map(maybeSplit)
        .flat();
}

export const maybeSplit = (text: string): Array<string> => {
    if (text.length < 3999) {
        return [text];
    }
    const sentences = text.split(/\. (?=[A-Z])/);
    if (sentences.length < 2) {
        console.log(text);
        throw new Error(`What cant sentence split folks ${text}`);
    }
    let buffer = sentences.shift();
    const res = [];
    while (sentences.length) {
        const next = sentences.shift() + '. ';
        if (buffer.length + next.length >= 4000) {
            res.push(buffer);
            buffer = next;
        } else {
            buffer += next;
        }
    }
    res.push(buffer);

    return res;
};

type Chapter = {
    src: string;
    label: string;
    playOrder: number;
    class: string;
    blobs: string[];
    hash: string;
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
                src: src.split('#')[0].split('?')[0],
                hash: src.split('#').slice(1).join('#'),
                label,
                playOrder: +point.attrs['playOrder'],
                class: point.attrs['class'],
                blobs: [],
            };
        })
        .filter((item) => item.class === 'chapter');
    return chapters;
}
