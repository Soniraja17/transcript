
import axios from "axios";
async function transcripting(videoid:string,video_url:string){
    const githuburl=`https://api.github.com/repos/${process.env.GITHUB_USERNAME}/${process.env.GITHUB_REPO_NAME2}/dispatches`

    await axios.post(githuburl,
        {
            event_type:'generate-transcript',
            client_payload:{
                inputUrl:video_url,
                videoId:videoid,
            }

        
        },
        {
            headers:{
                'Authorization': `Bearer ${process.env.GITHUB_PAT}`,
                'Accept': 'application/vnd.github.v3+json'

            }
        });
        console.log("transcript.ts work fine" ,githuburl);

}
export default transcripting;