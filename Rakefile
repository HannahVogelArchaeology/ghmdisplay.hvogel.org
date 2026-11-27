# Project tasks. Run `bundle exec rake -T` to list them. Needs ImageMagick (`magick` or `convert`).
require "fileutils"
require "json"
require "tmpdir"
require "yaml"

PHOTOS = %w[assets/images]

task default: :serve

desc "Generate responsive photos, then serve locally at http://127.0.0.1:4000/"
task serve: :images do
  sh "bundle exec jekyll serve"
end

desc "Generate responsive photos, then build production site into _site/"
task build: :images do
  sh({ "JEKYLL_ENV" => "production" }, "bundle exec jekyll build")
end

desc "Generate resized JPEG photos and blur placeholders (skips up-to-date outputs)"
task :images do
  im = %w[magick convert].find { |cmd| system(cmd, "-version", out: File::NULL, err: File::NULL) } or
    abort "ImageMagick not found. Install imagemagick and try again."
  sizes = YAML.load_file("_config.yml").fetch("image_sizes")
  originals = Dir.glob(PHOTOS.map { |d| "#{d}/**/*" }).select { |f| File.file?(f) && f.match?(/\.jpe?g\z/i) && !f.include?("/og/") }.sort
  resized = ->(src) { src.sub(%r{\Aassets/}, "assets/resized/").sub(/\.[^.]+\z/, "") }

  originals.each do |src|
    base = resized.(src)
    FileUtils.mkdir_p(File.dirname(base))
    sizes.each do |w|
      out = "#{base}-#{w}.jpg"
      next if File.exist?(out) && File.mtime(out) > File.mtime(src)
      sh im, src, "-auto-orient", "-resize", "#{w}x>", "-strip", "-interlace", "JPEG", "-quality", "78", out, verbose: false
    end
  end

  dims = {}
  lqip = Dir.mktmpdir do |tmp|
    originals.to_h do |src|
      mid = "#{resized.(src)}-#{sizes[1] || sizes.last}.jpg"
      dims_str = IO.popen([im, "identify", "-format", "%w %h", mid], &:read).strip
      w_px, h_px = dims_str.split.map(&:to_i)
      dims[src] = { "width" => w_px, "height" => h_px } if w_px > 0 && h_px > 0
      sh im, "#{resized.(src)}-#{sizes.min}.jpg", "-resize", "20x", "-quality", "40", "#{tmp}/p.jpg", verbose: false
      [src, "data:image/jpeg;base64,#{[File.binread("#{tmp}/p.jpg")].pack('m0')}"]
    end
  end
  File.write("_data/lqip.json", JSON.pretty_generate(lqip) + "\n")
  File.write("_data/image_dims.json", JSON.pretty_generate(dims) + "\n")
  puts "Photos ready: #{originals.size} originals, widths #{sizes.join(', ')}"
end
