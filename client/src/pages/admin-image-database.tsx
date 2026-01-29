import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { 
  Database,
  Image as ImageIcon, 
  Loader2, 
  Shield, 
  LogIn,
  Flame,
  Droplet,
  Mountain,
  Wind,
  Leaf,
  Crown,
  Download,
  Trash2,
  Upload,
  ArrowLeft,
  Search,
  Filter,
  Edit2,
  Check,
  X
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Element, CardImage } from "@shared/schema";

const elementConfig: Record<Element, { icon: typeof Flame; color: string; bg: string }> = {
  Fire: { icon: Flame, color: "text-red-500", bg: "bg-red-600/20" },
  Water: { icon: Droplet, color: "text-blue-500", bg: "bg-blue-600/20" },
  Earth: { icon: Mountain, color: "text-amber-500", bg: "bg-amber-600/20" },
  Air: { icon: Wind, color: "text-green-400", bg: "bg-green-400/20" },
  Nature: { icon: Leaf, color: "text-emerald-500", bg: "bg-emerald-600/20" },
};

export default function AdminImageDatabasePage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterElement, setFilterElement] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedImage, setSelectedImage] = useState<CardImage | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [uploadElement, setUploadElement] = useState<string>("");
  const [uploadType, setUploadType] = useState<string>("unit");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [useElement, setUseElement] = useState(false);
  const [bulkFiles, setBulkFiles] = useState<{ file: File; name: string; preview: string }[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const { data: adminCheck, isLoading: adminLoading } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    enabled: isAuthenticated,
  });

  const { data: cardImages = [], isLoading: imagesLoading } = useQuery<CardImage[]>({
    queryKey: ["/api/admin/card-images"],
    enabled: adminCheck?.isAdmin,
  });

  // Upload single image function
  const uploadSingleImage = async (name: string, imageBase64: string) => {
    const res = await apiRequest("POST", "/api/admin/upload-card-image", {
      name,
      imageBase64,
      element: useElement ? uploadElement : null,
      cardType: uploadType,
    });
    return res.json();
  };

  // Bulk upload handler
  const handleBulkUpload = async () => {
    if (bulkFiles.length === 0) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < bulkFiles.length; i++) {
      const { file, name } = bulkFiles[i];
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
        await uploadSingleImage(name, base64);
        successCount++;
      } catch (error) {
        failCount++;
        console.error(`Failed to upload ${name}:`, error);
      }
      setUploadProgress(Math.round(((i + 1) / bulkFiles.length) * 100));
    }
    
    setIsUploading(false);
    setBulkFiles([]);
    setShowUploadDialog(false);
    queryClient.invalidateQueries({ queryKey: ["/api/admin/card-images"] });
    
    toast({
      title: "Bulk Upload Complete",
      description: `Successfully uploaded ${successCount} image${successCount !== 1 ? "s" : ""}${failCount > 0 ? `, ${failCount} failed` : ""}`,
      variant: failCount > 0 ? "destructive" : "default",
    });
  };

  // Update image mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/card-images/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Image Updated",
        description: "Image metadata has been updated!",
      });
      setEditingName(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/card-images"] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update image",
        variant: "destructive",
      });
    },
  });

  // Delete image mutation
  const deleteMutation = useMutation({
    mutationFn: async (imageId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/card-images/${imageId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Image Deleted",
        description: "Image has been removed from the database.",
      });
      setSelectedImage(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/card-images"] });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete image",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const pngFiles = files.filter(f => f.type === "image/png" || f.name.toLowerCase().endsWith(".png"));
    
    if (pngFiles.length === 0) {
      toast({
        title: "No PNG Files",
        description: "Please select PNG files only.",
        variant: "destructive",
      });
      return;
    }
    
    const newFiles = pngFiles.map(file => ({
      file,
      name: file.name.replace(/\.png$/i, ""),
      preview: URL.createObjectURL(file),
    }));
    
    setBulkFiles(prev => [...prev, ...newFiles]);
    if (e.target) e.target.value = "";
  };

  const removeFile = (index: number) => {
    setBulkFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const updateFileName = (index: number, newName: string) => {
    setBulkFiles(prev => {
      const newFiles = [...prev];
      newFiles[index] = { ...newFiles[index], name: newName };
      return newFiles;
    });
  };

  // Filter images
  const filteredImages = cardImages.filter((img) => {
    const matchesSearch = img.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesElement = filterElement === "all" || img.element === filterElement;
    const matchesType = filterType === "all" || img.cardType === filterType;
    return matchesSearch && matchesElement && matchesType;
  });

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-purple-200">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-6 flex items-center justify-center">
        <Card className="max-w-md bg-slate-800/80 border-purple-500/30">
          <CardContent className="p-8 text-center">
            <LogIn className="w-16 h-16 text-purple-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Login Required</h2>
            <p className="text-purple-200 mb-6">Please sign in to access this page.</p>
            <Button 
              className="gap-2" 
              data-testid="button-login"
              onClick={() => { window.location.href = "/api/login"; }}
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!adminCheck?.isAdmin) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-6 flex items-center justify-center">
        <Card className="max-w-md bg-slate-800/80 border-red-500/30">
          <CardContent className="p-8 text-center">
            <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-slate-300 mb-4">This page is restricted to administrators only.</p>
            <Link href="/">
              <Button variant="outline" data-testid="button-go-home">
                Return Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/admin-card-art">
              <Button variant="ghost" size="icon" className="text-purple-300 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Card Image Database</h1>
              <p className="text-purple-300 text-sm">Manage your stored card artwork</p>
            </div>
          </div>
          
          <Button 
            className="gap-2" 
            onClick={() => setShowUploadDialog(true)}
            data-testid="button-upload-new"
          >
            <Upload className="w-4 h-4" />
            Upload Image
          </Button>
        </div>

        {/* Filters */}
        <Card className="bg-slate-800/80 border-purple-500/30">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search images..."
                    className="pl-10 bg-slate-700/50 border-purple-500/30 text-white"
                    data-testid="input-search"
                  />
                </div>
              </div>
              
              <div className="flex gap-2 items-center">
                <Filter className="w-4 h-4 text-slate-400" />
                <Select value={filterElement} onValueChange={setFilterElement}>
                  <SelectTrigger className="w-32 bg-slate-700/50 border-purple-500/30" data-testid="filter-element">
                    <SelectValue placeholder="Element" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Elements</SelectItem>
                    {(["Fire", "Water", "Earth", "Air", "Nature"] as Element[]).map((el) => {
                      const Icon = elementConfig[el].icon;
                      return (
                        <SelectItem key={el} value={el}>
                          <span className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${elementConfig[el].color}`} />
                            {el}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-32 bg-slate-700/50 border-purple-500/30" data-testid="filter-type">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="unit">Unit</SelectItem>
                    <SelectItem value="commander">Commander</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Badge variant="outline" className="text-purple-300">
                {filteredImages.length} image{filteredImages.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Image Grid */}
        {imagesLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : filteredImages.length === 0 ? (
          <Card className="bg-slate-800/80 border-purple-500/30">
            <CardContent className="p-12 text-center">
              <Database className="w-16 h-16 text-slate-500 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-white mb-2">No Images Found</h3>
              <p className="text-slate-400 mb-4">
                {searchQuery || filterElement !== "all" || filterType !== "all"
                  ? "No images match your search criteria."
                  : "Your image database is empty. Generate or upload some art to get started!"}
              </p>
              <Link href="/admin-card-art">
                <Button className="gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Generate Art
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredImages.map((img) => {
              const ElementIcon = img.element ? elementConfig[img.element as Element]?.icon : null;
              return (
                <div
                  key={img.id}
                  onClick={() => setSelectedImage(img)}
                  className="group relative rounded-lg overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-purple-500 bg-slate-800"
                  data-testid={`image-card-${img.id}`}
                >
                  <img 
                    src={img.imageUrl} 
                    alt={img.name} 
                    className="w-full aspect-square object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-0 left-0 right-0 p-2 translate-y-full group-hover:translate-y-0 transition-transform">
                    <p className="text-white text-sm font-medium truncate">{img.name}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {ElementIcon && (
                        <ElementIcon className={`w-3 h-3 ${elementConfig[img.element as Element].color}`} />
                      )}
                      <Badge variant="outline" className="text-xs">
                        {img.cardType}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Image Detail Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="bg-slate-800 border-purple-500/30 max-w-lg">
          {selectedImage && (
            <>
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-2">
                  {editingName ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="bg-slate-700/50 border-purple-500/30 text-white"
                        autoFocus
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          updateMutation.mutate({ id: selectedImage.id, updates: { name: newName } });
                        }}
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingName(false);
                          setNewName("");
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      {selectedImage.name}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setNewName(selectedImage.name);
                          setEditingName(true);
                        }}
                        className="h-6 w-6"
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <img 
                  src={selectedImage.imageUrl} 
                  alt={selectedImage.name} 
                  className="w-full rounded-lg border border-purple-500/30"
                />
                
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedImage.element && (
                    <Badge className={elementConfig[selectedImage.element as Element]?.bg}>
                      {selectedImage.element}
                    </Badge>
                  )}
                  <Badge variant="outline">{selectedImage.cardType}</Badge>
                  {selectedImage.createdAt && (
                    <span className="text-slate-400 text-xs">
                      Created: {new Date(selectedImage.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              
              <DialogFooter className="flex gap-2">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = selectedImage.imageUrl;
                    link.download = `${selectedImage.name}.png`;
                    link.click();
                  }}
                >
                  <Download className="w-4 h-4" />
                  Download
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="gap-2">
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-slate-800 border-red-500/30">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-white">Delete Image</AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-300">
                        Are you sure you want to delete "{selectedImage.name}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-slate-700 text-white border-slate-600 hover:bg-slate-600">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction 
                        className="bg-red-600 hover:bg-red-700"
                        onClick={() => deleteMutation.mutate(selectedImage.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={(open) => {
        if (!open && !isUploading) {
          setBulkFiles([]);
          setShowUploadDialog(false);
        }
      }}>
        <DialogContent className="bg-slate-800 border-purple-500/30 max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white">Bulk Upload Images</DialogTitle>
            <DialogDescription className="text-slate-300">
              Select multiple PNG files to upload. Names are auto-filled from filenames.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Options Row */}
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2">
                <Label className="text-purple-200">Card Type</Label>
                <Select value={uploadType} onValueChange={setUploadType}>
                  <SelectTrigger className="w-32 bg-slate-700/50 border-purple-500/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unit">Unit Card</SelectItem>
                    <SelectItem value="commander">Commander</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useElement}
                    onChange={(e) => setUseElement(e.target.checked)}
                    className="w-4 h-4 rounded border-purple-500/50 bg-slate-700 text-purple-500 focus:ring-purple-500"
                    data-testid="toggle-use-element"
                  />
                  <span className="text-purple-200 text-sm">Assign Element</span>
                </label>
                {useElement && (
                  <Select value={uploadElement || "Fire"} onValueChange={setUploadElement}>
                    <SelectTrigger className="w-28 bg-slate-700/50 border-purple-500/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["Fire", "Water", "Earth", "Air", "Nature"] as Element[]).map((el) => {
                        const Icon = elementConfig[el].icon;
                        return (
                          <SelectItem key={el} value={el}>
                            <span className="flex items-center gap-2">
                              <Icon className={`w-4 h-4 ${elementConfig[el].color}`} />
                              {el}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              </div>
              
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                data-testid="button-select-files"
              >
                <Upload className="w-4 h-4" />
                Select PNGs
              </Button>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,.png"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            
            {/* File List */}
            {bulkFiles.length > 0 && (
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-purple-200">{bulkFiles.length} file{bulkFiles.length !== 1 ? "s" : ""} selected</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setBulkFiles([])}
                    className="text-red-400 hover:text-red-300"
                    data-testid="button-clear-files"
                  >
                    Clear All
                  </Button>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {bulkFiles.map((item, index) => (
                    <div 
                      key={index} 
                      className="flex items-center gap-3 p-2 bg-slate-700/30 rounded-lg"
                    >
                      <img 
                        src={item.preview} 
                        alt={item.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                      <Input
                        value={item.name}
                        onChange={(e) => updateFileName(index, e.target.value)}
                        className="flex-1 bg-slate-700/50 border-purple-500/30 text-white text-sm"
                        data-testid={`input-file-name-${index}`}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeFile(index)}
                        className="text-red-400 hover:text-red-300"
                        data-testid={`button-remove-file-${index}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Progress Bar */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-purple-200">Uploading...</span>
                  <span className="text-purple-300">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div 
                    className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
            
            {bulkFiles.length === 0 && !isUploading && (
              <div 
                className="border-2 border-dashed border-purple-500/30 rounded-lg p-8 text-center cursor-pointer hover:border-purple-500/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-12 h-12 text-purple-400 mx-auto mb-3" />
                <p className="text-purple-200">Click to select PNG files</p>
                <p className="text-slate-400 text-sm mt-1">or drag and drop (multiple files supported)</p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => { setBulkFiles([]); setShowUploadDialog(false); }}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              className="gap-2"
              onClick={handleBulkUpload}
              disabled={bulkFiles.length === 0 || isUploading}
              data-testid="button-upload-all"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Upload {bulkFiles.length > 0 ? `${bulkFiles.length} Files` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
