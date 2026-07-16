# PowerShell Simple HTTP Server
# To allow CORS-free testing of the local puzzle game

$port = 8080
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "HTTP server started. Open your browser and go to: http://localhost:$port/"
Write-Host "Press Ctrl+C in this console to stop the server."

# Base directory
$baseDir = Get-Item .

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq "/") {
            $urlPath = "/index.html"
        }

        # Prevent directory traversal
        $safePath = $urlPath.Replace("/", [System.IO.Path]::DirectorySeparatorChar)
        if ($safePath.StartsWith([System.IO.Path]::DirectorySeparatorChar)) {
            $safePath = $safePath.Substring(1)
        }
        
        $localPath = [System.IO.Path]::Combine($baseDir.FullName, $safePath)

        if (Test-Path $localPath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($localPath)
            
            # Simple content type mapping
            $ext = [System.IO.Path]::GetExtension($localPath).ToLower()
            $contentType = "text/plain"
            switch ($ext) {
                ".html" { $contentType = "text/html; charset=utf-8" }
                ".htm"  { $contentType = "text/html; charset=utf-8" }
                ".js"   { $contentType = "application/javascript; charset=utf-8" }
                ".css"  { $contentType = "text/css; charset=utf-8" }
                ".png"  { $contentType = "image/png" }
                ".jpg"  { $contentType = "image/jpeg" }
                ".jpeg" { $contentType = "image/jpeg" }
                ".gif"  { $contentType = "image/gif" }
                ".ico"  { $contentType = "image/x-icon" }
            }

            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
    } catch {
        # Ignore errors from aborted requests
    } finally {
        if ($null -ne $response) {
            $response.Close()
        }
    }
}
