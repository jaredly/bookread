import React from 'react';
import { Text, View, ScrollView, TouchableHighlight } from 'react-native';
import {
    ExternalStorageDirectoryPath,
    DownloadDirectoryPath,
    readdir,
    readDir,
    ReadDirItem,
} from 'react-native-fs';

export const FileBrowser = ({
    onSelect,
    filter,
}: {
    onSelect: (item: ReadDirItem) => void;
    filter: (item: ReadDirItem) => boolean;
}) => {
    const [dir, setDir] = React.useState(DownloadDirectoryPath);

    const contents = usePromise(() => readDir(dir), [dir]);

    return (
        <ScrollView
            style={{ flex: 1, alignSelf: 'stretch' }}
            contentContainerStyle={{
                alignItems: 'stretch',
            }}
        >
            {contents && dir !== ExternalStorageDirectoryPath ? (
                <TouchableHighlight
                    onPress={() => {
                        setDir(dir.split('/').slice(0, -1).join('/'));
                    }}
                >
                    <View
                        style={{
                            marginHorizontal: 16,
                            marginVertical: 8,
                        }}
                    >
                        <Text
                            style={{
                                fontWeight: 'bold',
                            }}
                        >
                            {'../'}
                        </Text>
                    </View>
                </TouchableHighlight>
            ) : null}
            {contents ? (
                contents
                    .sort((a, b) => {
                        const d = +b.isDirectory() - +a.isDirectory();
                        return d === 0
                            ? a.name < b.name
                                ? -1
                                : a.name === b.name
                                ? 0
                                : 1
                            : d;
                    })
                    .map(
                        (name, i) =>
                            filter(name) ? (
                                <TouchableHighlight
                                    key={i}
                                    onPress={() => {
                                        if (name.isDirectory()) {
                                            setDir(name.path);
                                        } else {
                                            onSelect(name);
                                        }
                                    }}
                                >
                                    <View
                                        style={{
                                            marginHorizontal: 16,
                                            marginVertical: 8,
                                        }}
                                    >
                                        <Text
                                            style={
                                                name.isDirectory()
                                                    ? {
                                                          fontWeight: 'bold',
                                                      }
                                                    : {}
                                            }
                                        >
                                            {name.name}
                                        </Text>
                                    </View>
                                </TouchableHighlight>
                            ) : null,
                        // <View
                        //     key={i}
                        //     style={{
                        //         marginHorizontal: 16,
                        //         marginVertical: 8,
                        //     }}
                        // >
                        //     <Text style={{ fontStyle: 'italic' }}>
                        //         {name.name}
                        //     </Text>
                        // </View>
                    )
            ) : (
                <Text style={{ margin: 16 }}>Loading...</Text>
            )}
        </ScrollView>
    );
};

export const usePromise = <T,>(
    fn: () => Promise<T>,
    deps: Array<any>,
): null | T => {
    const [value, setValue] = React.useState(null as null | T);

    React.useEffect(() => {
        fn().then((v) => setValue(v));
    }, deps);

    return value;
};
