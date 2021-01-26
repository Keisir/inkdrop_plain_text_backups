import { promises as fs } from "fs";
import ImportSidebar from "./import_sidebar";
import ImportModal from "./import_modal";
import utilities from "./utilities";
import * as path from "path";

const self = (module.exports = {
    disposable: null,
    async activate() {
        if (inkdrop && !inkdrop.isMobile) {
            const backupPath = utilities.getBackupPath();
            if (backupPath) {
                const plainTextPath = utilities.getPlainTextPath(backupPath);
                self.disposable =
                    self.disposable || inkdrop.main.dataStore.getLocalDB();
                await utilities.getDataAndWriteAllNotes(
                    self.disposable,
                    plainTextPath
                );
                await utilities.writeMaps(plainTextPath, utilities.dataMap);

                inkdrop.components.registerClass(ImportSidebar);
                inkdrop.layouts.insertComponentToLayoutAfter(
                    ImportSidebar.layoutName,
                    "SideBarMenuItemTrash",
                    ImportSidebar.name
                );

                inkdrop.components.registerClass(ImportModal);
                inkdrop.layouts.addComponentToLayout(
                    ImportModal.layoutName,
                    ImportModal.name
                );
                try {
                    // Sync stuff on changes:
                    self.disposable.onChange(async (change) => {
                        try {
                            const typeOfChange = change.id.split(":")[0];

                            switch (typeOfChange) {
                                case "note":
                                    const bookPath = `${plainTextPath}/${
                                        utilities.dataMap.books[
                                            change.doc.bookId
                                        ]
                                    }`;
                                    if (!utilities.dataMap.notes[change.id]) {
                                        utilities.dataMap.notes[change.id] = {};
                                    }
                                    // If the title has changed, rename the old note.
                                    if (
                                        change?.doc?.title &&
                                        utilities.dataMap.notes[change.id]
                                            ?.title &&
                                        change.doc.title !==
                                            utilities.dataMap.notes[change.id]
                                                .title
                                    ) {
                                        const oldDataMap = await utilities.getDataMap(
                                            plainTextPath
                                        );

                                        await fs.rename(
                                            `${bookPath}/${
                                                oldDataMap.notes[change.id]
                                                    .title
                                            }.md`,
                                            `${bookPath}/${change.doc.title}.md`
                                        );
                                    }

                                    utilities.dataMap.notes[change.id].title =
                                        change.doc.title;
                                    utilities.dataMap.notes[
                                        change.id
                                    ].path = `${
                                        utilities.dataMap.books[
                                            change.doc.bookId
                                        ]
                                    }/${change.doc.title}.md`;

                                    await utilities.writeNote(
                                        `${plainTextPath}/${
                                            utilities.dataMap.notes[change.id]
                                                .path
                                        }`,
                                        change.doc.body
                                    );
                                    await utilities.writeMaps(
                                        plainTextPath,
                                        utilities.dataMap
                                    );

                                    break;
                                case "book":
                                    if (
                                        utilities?.dataMap?.books[change.id] &&
                                        change?.doc?.name &&
                                        change.doc.name !==
                                            path.basename(
                                                utilities.dataMap.books[
                                                    change.id
                                                ]
                                            )
                                    ) {
                                        const oldDataMap = await utilities.getDataMap(
                                            plainTextPath
                                        );

                                        await fs.rename(
                                            `${plainTextPath}/${
                                                oldDataMap.books[change.id]
                                            }`,
                                            `${plainTextPath}/${change.doc.name}`
                                        );

                                        let bookPath = await utilities.getBookPath(
                                            self.disposable,
                                            change.doc
                                        );

                                        utilities.dataMap.books[
                                            change.id
                                        ] = bookPath;

                                        await utilities.writeMaps(
                                            plainTextPath,
                                            utilities.dataMap
                                        );
                                    }
                                    break;
                            }
                        } catch (err) {
                            console.warn(
                                "Plain text backup may have had an issue:",
                                err
                            );
                        }
                    });
                } catch (onChangeErr) {
                    console.warn("onChange event threw an error:", onChangeErr);
                }
            }
        }
    },

    deactivate() {
        if (inkdrop && !inkdrop.isMobile) {
            if (self.disposable) {
                self.disposable.dispose();
            }

            inkdrop.components.deleteClass(ImportSidebar);
            inkdrop.layouts.removeComponentFromLayout(
                ImportSidebar.layoutName,
                ImportSidebar.name
            );

            inkdrop.components.deleteClass(ImportModal);
            layouts.removeComponentFromLayout("modal", ImportModal.name);
        }
    },
});
