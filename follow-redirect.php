<?php
function getRedirectUrl($url)
{
    stream_context_set_default(array(
        'http' => array(
            'method' => 'HEAD'
        )
    ));
    $headers = get_headers($url, 1);
    if ($headers !== false && isset($headers['Location'])) {
        return is_array($headers['Location']) ? array_pop($headers['Location']) : $headers['Location'];
    }
    return $url;
}

header('Access-Control-Allow-Origin: *');
echo getRedirectUrl($_GET["url"]);
echo " ";
//reticivis.net/follow-redirect.php?url=...
//follows redirects
//for evergreen