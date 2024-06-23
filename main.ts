import {
	App, Editor, MarkdownView, Notice,
	Plugin, PluginSettingTab, Setting
} from 'obsidian'; 

import { getFlower } from './flower';


interface FlowerPluginSettings {
	size: number;
	imagesFolder: string;
	seedFromTitle: boolean;
	titleRegex: string;
	seedFromSelection: boolean;
	selectionDelimiter: string;
	randomSeed: boolean;
}

const DEFAULT_SETTINGS: FlowerPluginSettings = {
	size: 300,
	imagesFolder: 'flowers',
	seedFromTitle: false,
    titleRegex: '\\d+',
    seedFromSelection: false,
    selectionDelimiter: ':',
    randomSeed: false
}

export default class FlowerPlugin extends Plugin {
	settings: FlowerPluginSettings;

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon('flower', 'Generate Flower', async () => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (view && view.editor) {
				await this.insertFlowerImage(view.editor, view);
			} else {
				new Notice('No active Markdwon Note was found!')
			}
		});

		this.addSettingTab(new FlowerSettingTab(this.app, this));
	}

	async onunload() {
		console.info('Unloading plugin...');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	isTitleValid(title: string | undefined): boolean {
		return title !== undefined && title !== 'Untitled';
	}

	async insertFlowerImage(editor: Editor, view: MarkdownView) {
		const noteName = view.file?.basename;

		let size = this.settings.size;
		let seed: string | null = null;
		let shouldClearSelection = false;

		if (this.isTitleValid(noteName) && this.settings.seedFromTitle && this.settings.titleRegex) {
			const regex = new RegExp(this.settings.titleRegex);
			const match = noteName?.match(regex);
			
			if (match && match[0] && !isNaN(Number(match[0]))) {
				seed = match[0];
				console.info(`Seed was found inside title:${seed} using regex`);
				new Notice(`Seed was found inside title:${seed} using regex!`);
			} else {
				console.warn(`Seed was not found: make sure regex was specified correctly to find number for seed in title`);
			}
		}

		const selectedText = editor.getSelection();
		if (this.settings.seedFromSelection && selectedText && selectedText.includes(this.settings.selectionDelimiter)) {
			const regex = new RegExp(`^(\\d{1,15})?${this.settings.selectionDelimiter}([1-9][0-9]{1,2}|1000)?$`);
			const groups = selectedText.match(regex);
			if (groups) {
				const group1 = groups[1];
				const group2 = groups[2];

				if (group1 !== undefined) {
					seed = group1;
					shouldClearSelection = true;
					console.info(`Seed was extarcted from selection:${seed}`);
					new Notice(`Seed was extarcted from selection:${seed}`);
				} else {
					console.warn('Seed was not provided in selection')
				}

				if (group2 !== undefined) {
					size = Number(group2);
					shouldClearSelection = true;
					console.info(`Size was extarcted from selection:${size}`);
					new Notice(`Size was extarcted from selection:${size}`);
				} else {
					console.warn('Size was not provided in selection')
				}
			} else {
				console.warn('Selection is in incorrect form');
			}
		} else if (selectedText && !selectedText.includes(this.settings.selectionDelimiter)) {
			console.warn('Selction could not be read: make sure you used correct delimiter (specified in settigns)');
		} else if (this.settings.seedFromSelection && !selectedText) {
			console.warn('Selection is empty');
		}

		if (this.settings.randomSeed) {
			seed = Math.floor(Math.random() * 1e9).toString();
			console.info(`RandomSeed setting is enabled: seed:${seed}`);
			new Notice(`Generated seed:${seed}`);
		}

		if (!seed) {
			seed = Math.floor(Math.random() * 1e9).toString();
			console.warn(`Seed was not found: random seed:${seed} was selected`)
			new Notice(`Generated seed:${seed}`);
		}

		const filename = `${size}.png`;
		const imagesFolder = this.settings.imagesFolder;

		try {
			const imagePath = await this.createFlowerImage(size, imagesFolder, seed, filename);

			if (imagePath) {
				const markdownImage = `![Flower Image](${imagePath})\n`;

				if (shouldClearSelection) {
					const from = editor.getCursor('from');
					const to = editor.getCursor('to');
					editor.replaceRange('', from, to);
					editor.replaceRange(markdownImage, from);
					editor.setCursor({ line: from.line + 2, ch: 0 });
				} else {
					const cursor = editor.getCursor();
					editor.replaceRange(markdownImage, cursor);
					editor.setCursor({ line: cursor.line + 2, ch: 0 });
				}

				console.info(`Flower image inserted: ${markdownImage}`);
				new Notice('Flower image inserted!');
			}
		} catch (error) {
			console.error('Failed to insert flower image', error);
			new Notice('Failed to insert flower image!');
		}
	}

	base64ToArrayBuffer(base64: string): ArrayBuffer {
		const binaryString = atob(base64);
		const len = binaryString.length;
		const bytes = new Uint8Array(len);
		for (let i = 0; i < len; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		return bytes.buffer;
	}

	async ensureFolderExists(folderPath: string) {
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        if (!folder) {
            await this.app.vault.createFolder(folderPath);
        }
    }

	async createFlowerImage(size: number, folder: string, seed: string, filename: string): Promise<string | null> {
		const imageFolderPath = `${folder}/${seed}`;
		const imagePath = `${imageFolderPath}/${filename}`;

		try {
			await this.ensureFolderExists(imageFolderPath);

			const exists = await this.app.vault.adapter.exists(imagePath);
			if (exists) {
				console.info(`Flower image ${filename} with seed:${seed} already exists`);
				return imagePath;
			}

			const flowerImage = getFlower(size, parseInt(seed));
			const base64Data = flowerImage.split(',')[1];
			const arrayBuffer = this.base64ToArrayBuffer(base64Data);

			await this.app.vault.createBinary(imagePath, arrayBuffer);
			console.info(`Flower image ${filename} with seed:${seed} was saved`);
            new Notice(`Flower image ${filename} with seed:${seed} was saved!`);
            
			return imagePath;
		} catch (error) {
			console.error('Failed to save flower image:', error);
			new Notice('Failed to save flower image!');
            return null;
		}
	}
}
	
class FlowerSettingTab extends PluginSettingTab {
    plugin: FlowerPlugin;

    constructor(app: App, plugin: FlowerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

		containerEl.createEl('h2', { text: 'Flower Plugin Settings' });

        new Setting(containerEl)
            .setName('Flower Image Size (px)')
            .setDesc('Set the size of the generated flower image.')
            .addSlider(slider => slider
                .setLimits(10, 1000, 10)
                .setValue(this.plugin.settings.size)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.size = value;
                    await this.plugin.saveSettings();
                })
            );
		
		new Setting(containerEl)
			.setName('Flower Images Folder')
			.setDesc('Root folder for generated flower image.')
			.addText(text => text
				.setPlaceholder('Enter folder name')
				.setValue(this.plugin.settings.imagesFolder)
				.onChange(async (value) => {
					this.plugin.settings.imagesFolder = value;
					await this.plugin.saveSettings();
				})
			);
		
		if (!this.plugin.settings.randomSeed) {
			new Setting(containerEl)
			.setName('Seed from Title with Regex')
			.setDesc('Extract seed value from note title using regex pattern.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.seedFromTitle)
				.onChange(async (value) => {
					this.plugin.settings.seedFromTitle = value;
					this.plugin.settings.randomSeed = false;
					await this.plugin.saveSettings();
					this.display();
				})
			);
		}
		
		if (this.plugin.settings.seedFromTitle) {
			new Setting(containerEl)
				.setName('Title Regex Pattern')
				.setDesc('Enter the regex pattern to extract seed from title.')
				.addText(text => text
					.setValue(this.plugin.settings.titleRegex)
					.onChange(async (value) => {
						this.plugin.settings.titleRegex = value;
						await this.plugin.saveSettings();
					})
				);
		}

		if (!this.plugin.settings.randomSeed) {
			new Setting(containerEl)
				.setName('Seed from Selection with Delimiter')
				.setDesc('Extract seed value from selected text using a delimiter.')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.seedFromSelection)
					.onChange(async (value) => {
						this.plugin.settings.seedFromSelection = value;
						this.plugin.settings.randomSeed = false;
						await this.plugin.saveSettings();
						this.display();
					})
				);
		}
		
		if (this.plugin.settings.seedFromSelection) {
			new Setting(containerEl)
				.setName('Selection Delimiter')
				.setDesc('Enter the delimiter to extract seed from selected text.')
				.addDropdown(dropdown => dropdown
					.addOptions(
						{
						':': ':',
						'@': '@',
						'-': '-',
						'#': '#'
					})
					.setValue(this.plugin.settings.selectionDelimiter)
					.onChange(async (value) => {
						this.plugin.settings.selectionDelimiter = value;
						await this.plugin.saveSettings();
					})
				);
		}

		if (!this.plugin.settings.seedFromSelection && !this.plugin.settings.seedFromTitle) {
			new Setting(containerEl)
            .setName('Random Seed')
            .setDesc('Generate a random seed for each flower image.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.randomSeed)
                .onChange(async (value) => {
                    this.plugin.settings.randomSeed = value;
					this.plugin.settings.seedFromTitle = false;
					this.plugin.settings.seedFromSelection = false;
                    await this.plugin.saveSettings();
					this.display();
                })
            );
		}
    }
}