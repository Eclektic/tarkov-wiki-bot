import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js'
import { Cluster } from 'puppeteer-cluster'

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
	
	const cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: 2,
        puppeteerOptions: {
            headless: true,
            userDataDir: './../userDataDir'
        }
    });

    cluster.queue('https://escapefromtarkov.fandom.com/fr/wiki/Sp%C3%A9cial:Recherche?fulltext=1&query=' + search);

	await cluster.task(async ({ page, data: url }) => {

		await page.setRequestInterception(true);

		page.on('request', (request) => {
			if (['image', 'stylesheet', 'font', 'script', 'media', 'object', 'sub_frame'].indexOf(request.resourceType()) !== -1) {
				request.abort();
			} else {
				request.continue();
			}
		});

		// Set screen size
		//await page.setViewport({width: 1920, height: 1080})

		// Navigate the page to a URL
		await page.goto(url)

		// Wait and click on first result
		const searchResultSelector = '.unified-search__result__title'
		try {
			await page.waitForSelector(searchResultSelector, { timeout: 3000 })
		} catch(err) {
			// Edit reply with embed
			await interaction.editReply({ content: 'Sorry bro, no result found for: ' + search, files: [] })
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
		const currentUrl = page.url()

		// Get main text
		const elMainText = await page.$x('//table[@id="va-infobox0"]/following-sibling::p[1]')
		let mainText = '-'
		if(elMainText.length >= 1) {
			mainText = await page.evaluate(el => el.textContent, elMainText[0])
		}

		// Create embed
		let wikiEmbed = new EmbedBuilder()
			.setTitle(mainTitle)
			.setURL(currentUrl)
			.setDescription(mainText)
			.setColor('#9a8866')
		
		if(thumbImg) {
			wikiEmbed.setThumbnail(thumbImg)
		}

		// Edit reply with embed
		await interaction.editReply({ content: 'Result for: ' + search, embeds: [wikiEmbed], files: [] })
	})

	cluster.on('taskerror', (err, data, willRetry) => {
        if (willRetry) {
          console.warn(`Encountered an error while crawling ${data}. ${err.message}\nThis job will be retried`);
        } else {
          console.error(`Failed to crawl ${data}: ${err.message}`);
        }
    })

	await cluster.idle();
    await cluster.close();
}