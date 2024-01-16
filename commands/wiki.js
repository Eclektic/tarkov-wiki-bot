import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js'
import puppeteer from 'puppeteer';

export const data = new SlashCommandBuilder()
	.setName('w')
	.setDescription('Search on wiki')
	.addStringOption(option =>
		option.setName('keywords')
			.setDescription('What do you want to search?')
			.setRequired(true)
	);
export async function execute(interaction) {
	const search = interaction.options.getString('keywords')

	const loadingImg = new AttachmentBuilder('./assets/eft-escape-from-tarkov-small.gif')
	await interaction.reply({ content: 'Search in progress for: ' + search, files:[loadingImg] })

	// Launch the browser and open a new blank page
    const browser = await puppeteer.launch({ headless: 'new', userDataDir: './../userDataDir' })
    const page = await browser.newPage()

	await page.setRequestInterception(true);

	page.on('request', (request) => {
		if (['image', 'stylesheet', 'font', 'script'].indexOf(request.resourceType()) !== -1) {
			request.abort();
		} else {
			request.continue();
		}
	});

    // Set screen size
    //await page.setViewport({width: 1920, height: 1080})

    // Navigate the page to a URL
    await page.goto('https://escapefromtarkov.fandom.com/fr/wiki/Sp%C3%A9cial:Recherche?fulltext=1&query=' + search)

    // Wait and click on first result
    const searchResultSelector = '.unified-search__result__title'
	try {
    	await page.waitForSelector(searchResultSelector, { timeout: 3000 })
	} catch(err) {
		// Close headless session
	    await browser.close()
        // Edit reply with embed
	    await interaction.editReply('Sorry bro, no result found for: ' + search)
        return false
	}
	await page.focus(searchResultSelector)

    await Promise.all([
		page.waitForNavigation({ timeout: 10000 }),
		page.keyboard.type('\n')
    ]);

    // Locate the main title
	await page.waitForSelector('.mw-page-title-main')
    const elementMainTitle = await page.$('.mw-page-title-main')
    const mainTitle = await elementMainTitle.evaluate(el => el.textContent)

	// Locate thumb img
	const thumbImgSelector = '.va-infobox-mainimage-image img'
	const thumbImgElement = await page.$(thumbImgSelector)
	let thumbImg
	if(thumbImgElement) {
		thumbImg = await thumbImgElement.evaluate(el => el.getAttribute('data-src') ? el.getAttribute('data-src') : el.getAttribute('src'))
	}
	
	// Retrieve current url 
	const url = page.url()

	// Get main text
	const elMainText = await page.$x('//table[@id="va-infobox0"]/following-sibling::p[1]')
	let mainText = '-'
	if(elMainText.length >= 1) {
		mainText = await page.evaluate(el => el.textContent, elMainText[0])
	}

	// Close headless session
	await browser.close();

	// Create embed
	let wikiEmbed = new EmbedBuilder()
		.setTitle(mainTitle)
		.setURL(url)
		.setDescription(mainText)
		.setColor('#9a8866')
	
	if(thumbImg) {
		wikiEmbed.setThumbnail(thumbImg)
	}

	// Edit reply with embed
	await interaction.editReply({ content: 'Result for: ' + search, embeds: [wikiEmbed], files: [] })
}